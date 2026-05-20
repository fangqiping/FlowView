# FlowView

`FlowView` is the companion frontend for the WMS + WCS demo. It provides:

- inbound and outbound order worklists
- flow definition versioning and publish screens
- a visual flow editor
- flow task execution graphs with cancel, retry, and skip actions

## Requirements

- Node.js 22+
- the backend demo running at `http://127.0.0.1:5086`, or another compatible URL

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Create a local env file if you need a backend URL other than the default:

```bash
cp .env.example .env.local
```

3. Start the dev server:

```bash
npm run dev
```

4. Open the app:

```text
http://127.0.0.1:5173
```

If you do not set `VITE_API_BASE_URL`, the frontend talks to `http://127.0.0.1:5086`.

## Common Commands

Run tests:

```bash
npm test
```

Run lint:

```bash
npm run lint
```

Build for production:

```bash
npm run build
```

## Key Routes

- `/orders/inbound`
- `/orders/outbound`
- `/flows`
- `/flows/inbound-basic/editor`

## Working With The Demo

The easiest local loop is:

1. start `Backend.Demo`
2. start `FlowView`
3. create an inbound or outbound order
4. trigger `Create & Start Demo`
5. open the execution graph to inspect node progress and runtime controls
