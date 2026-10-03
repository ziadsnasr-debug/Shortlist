// One address for the e2e server. Set E2E_PORT to run beside another
// checkout's suite on the same machine; CI uses the default.
export const port = Number(process.env.E2E_PORT ?? 3217);
export const origin = `http://127.0.0.1:${port}`;
