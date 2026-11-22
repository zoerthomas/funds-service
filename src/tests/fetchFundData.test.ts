import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fixture from "./__fixtures__/growth-cautious.json";

vi.mock("../config", () => ({
  config: {
    fundSourceUrl: "https://example.test/{code}.json",
    fundCodes: ["BYW8RV9", "BROKEN"],
    fetchTimeoutMs: 10_000,
  },
}));
vi.mock("../fundDb", () => ({ upsertFund: vi.fn() }));

import { config } from "../config";
import { refreshFunds } from "../fetchFundData";
import { upsertFund } from "../fundDb";

const stubFetch = (
  handler: (url: string, init?: RequestInit) => Promise<Response>,
) => {
  const fetchMock = vi.fn(handler);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

const goodResponse = () => Response.json(structuredClone(fixture));

const storedCodes = () =>
  vi.mocked(upsertFund).mock.calls.map(([fund]) => fund.code);

let error: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  config.fundCodes = ["BYW8RV9", "BROKEN"];
  error = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("refreshFunds", () => {
  it("fetches each code and keeps going when one fails", async () => {
    const fetchMock = stubFetch(async (url) =>
      url.includes("BROKEN")
        ? new Response("Generic Error", { status: 500 })
        : goodResponse(),
    );

    await refreshFunds();

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.test/BYW8RV9.json",
      expect.anything(),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.test/BROKEN.json",
      expect.anything(),
    );
    expect(upsertFund).toHaveBeenCalledTimes(1);
    expect(upsertFund).toHaveBeenCalledWith(
      expect.objectContaining({ code: "BYW8RV9" }),
    );
    expect(error).toHaveBeenCalledTimes(1);
  });

  it("stores one fund per code when everything succeeds", async () => {
    config.fundCodes = ["AAAAAA1", "BBBBBB2", "CCCCCC3"];
    stubFetch(async () => goodResponse());

    await refreshFunds();

    expect(storedCodes()).toEqual(["AAAAAA1", "BBBBBB2", "CCCCCC3"]);
    expect(error).not.toHaveBeenCalled();
  });

  it("stamps every fund in one run with the same fetch time", async () => {
    config.fundCodes = ["AAAAAA1", "BBBBBB2"];
    stubFetch(async () => goodResponse());

    await refreshFunds();

    const [first, second] = vi
      .mocked(upsertFund)
      .mock.calls.map(([fund]) => fund.lastUpdated);
    expect(first).toBe(second);
    expect(new Date(first).toISOString()).toBe(first);
  });

  it("does nothing when there are no fund codes", async () => {
    config.fundCodes = [];
    const fetchMock = stubFetch(async () => goodResponse());

    await refreshFunds();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(upsertFund).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it("URL-encodes the fund code", async () => {
    config.fundCodes = ["A B/C"];
    const fetchMock = stubFetch(async () => goodResponse());

    await refreshFunds();

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.test/A%20B%2FC.json",
      expect.anything(),
    );
  });

  it("passes an abort signal so a stalled request can time out", async () => {
    config.fundCodes = ["AAAAAA1"];
    const fetchMock = stubFetch(async () => goodResponse());

    await refreshFunds();

    expect(fetchMock.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it("skips a fund whose request times out and carries on", async () => {
    config.fundCodes = ["SLOWSLO", "BYW8RV9"];
    stubFetch(async (url) => {
      if (url.includes("SLOWSLO"))
        throw new DOMException("timed out", "TimeoutError");
      return goodResponse();
    });

    await refreshFunds();

    expect(storedCodes()).toEqual(["BYW8RV9"]);
    expect(String(error.mock.calls[0][0])).toContain("SLOWSLO");
  });

  describe("when a fund can't be refreshed", () => {
    it.each([
      [
        "the request fails outright",
        async () => {
          throw new TypeError("fetch failed");
        },
      ],
      [
        "upstream returns 404",
        async () => new Response("not found", { status: 404 }),
      ],
      [
        "the body isn't JSON",
        async () => new Response("<html>oops</html>", { status: 200 }),
      ],
      [
        "the body doesn't match the expected shape",
        async () => Response.json({ data: { quote: { name: "only a name" } } }),
      ],
    ])("skips it, logs it and carries on when %s", async (_label, broken) => {
      config.fundCodes = ["BROKEN1", "BYW8RV9"];
      stubFetch(async (url) =>
        url.includes("BROKEN1") ? broken() : goodResponse(),
      );

      await refreshFunds();

      expect(storedCodes()).toEqual(["BYW8RV9"]);
      expect(error).toHaveBeenCalledTimes(1);
      expect(String(error.mock.calls[0][0])).toContain("BROKEN1");
    });

    it("logs a storage failure and still stores the remaining funds", async () => {
      config.fundCodes = ["AAAAAA1", "BBBBBB2"];
      stubFetch(async () => goodResponse());
      vi.mocked(upsertFund).mockImplementationOnce(() => {
        throw new Error("disk full");
      });

      await refreshFunds();

      expect(storedCodes()).toEqual(["AAAAAA1", "BBBBBB2"]);
      expect(error).toHaveBeenCalledTimes(1);
      expect(String(error.mock.calls[0][0])).toContain("AAAAAA1");
    });
  });
});
