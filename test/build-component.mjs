// Compiles the JSX component to plain ESM so the render smoke test can import it.
import { build } from "esbuild";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
await build({
  entryPoints: [join(here, "../src/RFF_Retirement_Calculator.jsx")],
  outfile: join(here, "component.mjs"),
  bundle: true, format: "esm", platform: "node", jsx: "automatic",
  external: ["react", "react-dom", "react/jsx-runtime"],
  loader: { ".png": "dataurl" }, logLevel: "error",
});
