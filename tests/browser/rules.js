// A defect inside a shadow root: a label that refers to a missing id. The rules must check each root.
const root = document.getElementById('host').attachShadow({ mode: 'open' });
const label = document.createElement('label');
label.htmlFor = 'missing';
label.textContent = 'Branch';
root.append(label);
// A touch target that is too small, inside a shadow root.
const small = document.createElement('button');
small.textContent = 'Go';
small.style.cssText = 'width: 20px; height: 20px; padding: 0; border: 0;';
root.append(small);
window.muRulesReady = true;
