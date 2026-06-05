## 2024-06-05 - Material Icons and Screen Readers
**Learning:** Material Icon ligatures (e.g., `skip_previous`) placed inside buttons will be literally read aloud by screen readers if not hidden, creating a confusing and unpleasant experience for visually impaired users.
**Action:** Always add `aria-hidden="true"` to the icon `span` element and pair it with a descriptive `aria-label` on the parent `<button>` for icon-only buttons.
