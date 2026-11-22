# Funds Service
Service that retrieves and stores fund data, and makes it available to the front end via a REST API.

### Getting started
`cp .env.example .env`

`npm install`

`npm run dev`

### API endpoints 

- **GET /openapi.json** - returns the zod generated spec
- **GET /funds** - returns all funds and their summaries
    - **Filters**: 
        - `maxOngoingCharge`: maximum ongoing charge
        - `minAnalystRating`: minimum analyst rating
        - `maxRiskRating`: maximum risk rating
        - `sector`: flexible or mixed sector
        - `sort`: defaults to `Name`
        - `order`: defaults to ascending

- **GET /funds/:code** - returns the details of a fund

### Scripts
- `npm run dev`: starts the server with auto-reload
- `npm run build`: compiles TypeScript to `dist/`
- `npm start`: runs the compiled server from `dist/` (run `npm run build` first)
- `npm test`: runs the vitest suite in watch mode
- `npm run typecheck`: type checks without emitting files
- `npm run lint`: lints `src` with oxlint
- `npm run format`: formats `src` with Prettier
- `npm run format:check`: checks formatting without changing files

### Assumptions

- Validation schema: It's built off of the examples, so any fields that have returned as null are nullable, and those that always return are required, there's no caps on field length. In a prod application we would ideally have API docs to build off of.
- Data freshness: Funds are updated daily at 5 minutes past noon - this was from a quick google that said funds update at noon, but would assume a stakeholder would have this info. The cron job is able to be amended easily.
- Responsible fund: Though the responsible fund is presented separately in the doc, it shares the structure of the other funds (besides currency) and so I have not treated it distinctly to keep the scope small.
- Historic data: If we wanted to use historic fund data (e.g. return whether the `lastPrice` has increased or decreased) we would want to store previous calls. However I felt this was out of scope for this ticket.
- GBP/GBX: I have gone with GBX, as this seems to be the norm in stock trading. Prices are not rounded, and the GBP to GBX conversion uses `decimal.js` so multiplying by 100 adds no floating point noise (`1.20138` becomes `120.138`, not `120.13799999999999`). 

### More time/scaling
- Contract testing: would add a guard around any breaking changes that could be made to the API we're consuming from 
- Filters: I've run with the filters in the doc to keep the scope small but we may want to build on them depending on how they are displayed in the front end (e.g. would someone want to filter based on a minimum `riskRating`).
- SQLite: Wouldn't be viable if we wanted to run this application on a distributed system.
- Table indexing: If we did want to store previous calls we'd want to add an index the table and instead use a call id for a primary key as opposed to the fund code.
- API spec: simple JSON route but with more time a Swagger UI might be preferable.