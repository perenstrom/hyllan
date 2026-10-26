"use client";

import { useEffect, useId, useRef, useState } from "react";

import type { BatchDirection } from "./batch-entry";
import type { BatchItemOption } from "./batch-entry-row";
import { BarcodeItemPicker } from "./barcode-item-picker";
import {
  ProductNameSuggestionChip,
  useProductNameSuggestion,
} from "./product-name-suggestion";
import { ScanAmountStep, type ChosenItem } from "./scan-amount-step";
import type { BarcodeRegistrationChoice } from "./scan-actions";
import { KEYBOARD_DIALOG_CLASS } from "@/app/dialog-styles";
import type { ScannedBarcode } from "@/lib/barcode";

type Props = {
  barcode: ScannedBarcode;
  // "register": an unregistered scan in add mode. "correct": "Wrong item?"
  // on a logged scan, repointing a barcode that's already registered.
  mode: "register" | "correct";
  // "correct" only: the item the scan was wrongly counted against, whose
  // change has already been undone.
  wrongItemName?: string;
  items: BatchItemOption[];
  // Remove never creates (PER-278's locked decision).
  direction: BatchDirection;
  pending: boolean;
  error: string | null;
  onPick: (choice: BarcodeRegistrationChoice) => void;
  onCancel: () => void;
};

// The pick-or-create card (prototyped in PER-278 as an inline panel; a
// modal card since phone QA found the keyboard covering it below the
// camera), in two steps: which pantry item the barcode belongs to
// (BarcodeItemPicker), then how much one scan of it is (ScanAmountStep).
// The typed name and the name suggestion live here rather than in the
// step, so "Change" back to step one finds them as they were.
export function BarcodeRegisterPanel({
  barcode,
  mode,
  wrongItemName,
  items,
  direction,
  pending,
  error,
  onPick,
  onCancel,
}: Props) {
  const headingId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const allowCreate = direction === "add";
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<ChosenItem | null>(null);
  const { suggestion, dismiss } = useProductNameSuggestion(
    barcode.value,
    mode === "register",
  );

  // Mounted only while there's a barcode to settle, so opening on mount
  // is the whole lifecycle — same as ReassignBarcodeDialog.
  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={headingId}
      onClose={onCancel}
      className={`${KEYBOARD_DIALOG_CLASS} text-sm sm:max-w-md`}
    >
      <h2
        id={headingId}
        className="text-lg font-semibold text-black dark:text-zinc-50"
      >
        {mode === "register" ? "New barcode" : "Change barcode item"}
      </h2>
      <p className="mt-1 text-zinc-600 dark:text-zinc-400">
        {mode === "register"
          ? `${barcode.value} isn't registered yet. Pick the pantry item it belongs to${allowCreate ? ", or add it as new" : ""}.`
          : `Undid the scan on ${wrongItemName}. Pick the pantry item ${barcode.value} should count as instead.`}
      </p>

      {chosen ? (
        <ScanAmountStep
          key={chosen.name}
          chosen={chosen}
          direction={direction}
          pending={pending}
          onBack={() => setChosen(null)}
          onConfirm={(quantityPerScan, unit) =>
            onPick({
              target: chosen.target,
              quantityPerScan,
              newItemUnit: chosen.unit === null ? unit : undefined,
            })
          }
        />
      ) : (
        <BarcodeItemPicker
          items={items}
          query={query}
          onQueryChange={setQuery}
          allowCreate={allowCreate}
          pending={pending}
          suggestion={
            <ProductNameSuggestionChip
              suggestion={suggestion}
              onUse={setQuery}
              onDismiss={dismiss}
            />
          }
          onChoose={setChosen}
        />
      )}

      {error && (
        <p role="alert" className="mt-2 text-red-600">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={onCancel}
        className="mt-2 -mb-1 py-2 text-zinc-600 underline sm:py-1 sm:text-xs dark:text-zinc-400"
      >
        Cancel
      </button>
    </dialog>
  );
}
