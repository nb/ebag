import assert from "node:assert/strict";
import { warnUnknownOrderStatuses } from "../dist/cli/warnings.js";

function captureStderr(fn) {
  let output = "";
  const originalWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = (chunk) => {
    output += String(chunk);
    return true;
  };
  try {
    fn();
  } finally {
    process.stderr.write = originalWrite;
  }
  return output;
}

const warningOutput = captureStderr(() =>
  warnUnknownOrderStatuses([
    {
      id: "ORDER-UNKNOWN",
      status: 99,
      statusText: "Нова",
    },
  ]),
);
assert.match(
  warningOutput,
  /Unknown order status \(Нова\) for order ORDER-UNKNOWN/,
);
assert.match(warningOutput, /https:\/\/github\.com\/nb\/ebag\/issues/);

const noWarningOutput = captureStderr(() =>
  warnUnknownOrderStatuses([
    {
      id: "ORDER-KNOWN",
      status: 0,
      statusText: "Нова",
    },
  ]),
);
assert.equal(noWarningOutput, "");

console.log("cli-warnings.test ok");
