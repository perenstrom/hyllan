import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// vitest.config.ts doesn't set `test.globals`, so RTL's auto-cleanup (which
// relies on detecting a global `afterEach`) never registers on its own.
afterEach(cleanup);

// jsdom doesn't implement <dialog>'s showModal()/close() (only the `open`
// attribute's display toggling) — polyfill just enough for
// delete-account-dialog.tsx's usage to work under jsdom.
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
}
if (!HTMLDialogElement.prototype.close) {
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
}
