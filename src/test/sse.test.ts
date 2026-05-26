import * as assert from "assert";
import { appendStreamText } from "../api/sse";

suite("appendStreamText", () => {
  test("treats first payload as full text", () => {
    const result = appendStreamText("", "hello");
    assert.strictEqual(result.next, "hello");
    assert.strictEqual(result.delta, "hello");
  });

  test("treats cumulative payload as suffix only", () => {
    const result = appendStreamText("hel", "hello");
    assert.strictEqual(result.next, "hello");
    assert.strictEqual(result.delta, "lo");
  });

  test("treats incremental payload as append", () => {
    const result = appendStreamText("hel", "lo");
    assert.strictEqual(result.next, "hello");
    assert.strictEqual(result.delta, "lo");
  });

  test("ignores duplicate cumulative payload", () => {
    const result = appendStreamText("hello", "hello");
    assert.strictEqual(result.next, "hello");
    assert.strictEqual(result.delta, "");
  });
});
