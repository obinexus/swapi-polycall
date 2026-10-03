# swapi-polycall

A small [Star Wars API](https://swapi.dev) REST client: it checks the
operation and id before sending a request, fetches `OPERATION/ID`, checks
the response shape, and wraps it as `{ polycall: {...}, data }`.

**This is not a Polycall binding.** It does not load, call or depend on the
[Polycall core](https://github.com/obinexus/polycall); the `polycall` block in
its result is this package's own verification record, and
`swapi-polycall.ini` is its own settings file, not a Polycall configuration.

## Use

```sh
npx swapi-polycall people 1
```

```js
const { polycallSwapi } = require("swapi-polycall");
const { data } = await polycallSwapi("planets", 1);            // swapi.dev/api/planets/1/
await polycallSwapi("people", 1, { baseUrl: "http://localhost:8080/api", timeoutMs: 2000 });
```

Operations: `people`, `planets`, `starships`, `films`, `species`,
`vehicles`; ids are positive integers. Settings come from
`swapi-polycall.ini` next to `index.js` (or `SWAPI_POLYCALL_CONFIG`);
`SWAPI_BASE_URL` overrides the base URL.

## Tests

```sh
npm test                  # local stub server; the live request is skipped
SWAPI_LIVE=1 npm test     # also one real request to swapi.dev
```

## License

MIT -- see [LICENSE](LICENSE).
