# Coding Standards

## Effects (`useEffect`)

`useEffect` exists to synchronize a component with an external system (the DOM, a subscription, a network connection, a third-party widget). If nothing external is involved, an Effect is very likely the wrong tool. Before reaching for `useEffect`, check whether the case at hand matches one of the anti-patterns below.

Reference: [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect) (react.dev).

### Don't use an Effect to derive render data

Calculate derived values directly during render instead of storing them in state and syncing via an Effect.

```tsx
// ❌ Avoid
const [fullName, setFullName] = useState("");
useEffect(() => {
  setFullName(`${firstName} ${lastName}`);
}, [firstName, lastName]);

// ✅ Good
const fullName = `${firstName} ${lastName}`;
```

For expensive computations, use `useMemo` instead of state + Effect:

```tsx
// ✅ Good
const visibleItems = useMemo(
  () => filterItems(items, filter),
  [items, filter],
);
```

### Don't use an Effect to reset or adjust state on prop change

Resetting all of a component's state when a prop (e.g. an id) changes is a job for the `key` prop, not an Effect — it recreates the component instance instead of costing an extra render:

```tsx
// ❌ Avoid
useEffect(() => {
  setComment("");
}, [pantryItemId]);

// ✅ Good
<ItemEditor pantryItemId={pantryItemId} key={pantryItemId} />;
```

When only part of the state needs adjusting, prefer computing it directly during render rather than mirroring it into state:

```tsx
// ✅ Good
const selectedItem = items.find((item) => item.id === selectedId) ?? null;
```

### Don't use an Effect to respond to a user action

If code runs because of a specific event (click, submit), put it in that event handler, not in an Effect watching for the resulting state change. This includes POST requests, notifications, and analytics tied to a click or submit.

```tsx
// ❌ Avoid
useEffect(() => {
  if (isSubmitting) {
    postPantryItem(item);
  }
}, [isSubmitting]);

// ✅ Good
function handleSubmit() {
  postPantryItem(item);
}
```

Shared logic between multiple handlers (e.g. a "buy" action reachable from two buttons) belongs in a plain function both handlers call — not in an Effect keyed off state those handlers set.

### Don't chain Effects to compute a sequence of state updates

A cascade of Effects, each triggering the next via state, is hard to follow and costs a render per step. Compute the whole chain inside the one event handler that starts it.

### Don't use an Effect to notify a parent or pass data up

A child calling a parent callback inside an Effect, purely to report its own state, usually means the state should be lifted or the callback should be invoked directly from the event handler that changed the state. Fetched data should be fetched by the component that needs to pass it down, not fetched by a child and pushed up.

### Do use an Effect for real synchronization

Effects remain the right tool for:

- Subscribing to an external store or browser API (prefer `useSyncExternalStore` over a manual `addEventListener`/cleanup Effect when subscribing to a store).
- Client-side data fetching that must stay in sync with changing props (guard against race conditions with an `ignore` flag or `AbortController`, and clean up on unmount).
- One-time app initialization that has no natural event to hang off of — guard against React's double-invoke in development.

In this codebase, prefer fetching data in Server Components or Route Handlers over client-side Effects wherever the data is available at request time; reach for a client-side fetch Effect only when the fetch genuinely depends on client-only state (e.g. user interaction after mount).
