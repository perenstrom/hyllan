// The attribution Open Food Facts' ODbL licence requires wherever a name
// it supplied is shown (ADR 0008). Callers set the surrounding text style.
export function OpenFoodFactsCredit() {
  return (
    <>
      via{" "}
      <a
        href="https://world.openfoodfacts.org"
        target="_blank"
        rel="noreferrer"
        className="underline"
      >
        Open Food Facts
      </a>
    </>
  );
}
