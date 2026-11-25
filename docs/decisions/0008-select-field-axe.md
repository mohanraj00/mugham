# 0008: Axe check for the select field example

Issue #120 requires an axe check on the library branch example. The example adds combobox and listbox roles to the kit.

The browser check runs axe-core 4.10.3 on the library branch page. CI gets this version with `npm pack --ignore-scripts` and keeps the file in the runner temporary folder. The example and the kit load no axe code. The kit package and its dependency rules stay the same.

For a local browser check with axe, set `MUGHAM_AXE_CORE` to the path of `axe.min.js` from that package. The browser check reports each violation. The project checks still cover the keyboard, focus, touch targets, forced colors and reduced motion.
