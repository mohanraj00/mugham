// A defect inside a shadow root: a label that refers to a missing id. The rules must check each root.
const root = document.getElementById('host').attachShadow({ mode: 'open' });
const label = document.createElement('label');
label.htmlFor = 'missing';
label.textContent = 'Branch';
root.append(label);
window.muRulesReady = true;
