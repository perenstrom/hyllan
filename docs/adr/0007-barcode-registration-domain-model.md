# Barcode registration is a many-barcodes-to-one-item mapping, normalized across UPC-A/EAN-13

A scanned barcode needs to resolve to a pantry item so batch add/remove ([Batch stock entry with barcode scanning](https://linear.app/per-enstrom/issue/PER-274)) can act on it. We introduce a **Barcode registration** entity: `(household_id, pantry_item_id, barcode_value, symbology, created_at)`, unique on `(household_id, barcode_value)`. An item can carry many barcode registrations — real packaging assigns a distinct GTIN per pack size/variant of the same product — but a given barcode resolves to exactly one item within a household at a time.

`barcode_value` is stored in a canonical numeric form: UPC-A is zero-padded to its equivalent 13-digit EAN-13 value before comparison/storage, since the two symbologies encode the identical GS1 number for the same physical product — without this, scanning the same product as UPC-A once and EAN-13 another time would silently create two registrations instead of resolving to one. EAN-8 carries no such derivable equivalence to EAN-13/UPC-A (it's a separately-assigned short code, not a truncation) and is stored as its own distinct value. `symbology` is retained purely as informational metadata and plays no part in identity or uniqueness.

Scanning/registering a barcode already linked to item X against a different item Y prompts the household to confirm the reassignment rather than silently overwriting the existing link or hard-rejecting the attempt — silent overwrite risks an accidental mis-scan quietly repointing a working registration, while a hard reject would block the legitimate case of correcting an earlier mistake. Deleting a pantry item cascade-deletes its barcode registrations, matching the cascade-on-delete pattern already established for household → pantry item (ADR 0002); an orphaned registration pointing at nothing would serve no purpose, and re-scanning that barcode later simply re-triggers inline registration.

## Considered Options

- One barcode per item only — rejected; real packaging assigns different GTINs to different pack sizes/variants of what a household considers a single tracked item.
- Keeping UPC-A and EAN-13 as distinct, symbology-keyed values — rejected; would let the same physical barcode register twice depending on which symbology decoded it.
- Silent overwrite on reassignment — rejected; too easy for an accidental mis-scan to quietly corrupt a working mapping.
- Hard reject on reassignment — rejected; blocks the legitimate case of correcting an earlier mis-registration.
- Retaining orphaned registrations after item deletion — rejected; no soft-delete/orphan-retention precedent exists elsewhere in this domain, and it serves no purpose.
