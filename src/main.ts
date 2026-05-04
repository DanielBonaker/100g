// 100g — bootstrap entry point.
// The shell + engine wiring lands in subsequent vertical-slice issues.
// For now this is the placeholder that proves the build chain works.

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) throw new Error("missing #app root element");

root.innerHTML = `
  <main>
    <h1>100g</h1>
    <p>100 mini-games. 100 days. Factory under construction.</p>
  </main>
`;
