function line(text, opts = {}) {
  const div = document.createElement('div');
  if (opts.strong) {
    const strong = document.createElement('strong');
    strong.textContent = text;
    div.appendChild(strong);
  } else {
    div.textContent = text;
  }
  return div;
}

export function buildTooltipNode(p, ytd) {
  const yhat = Math.round(p.yhat);
  const lo   = Math.round(p.piLow);
  const hi   = Math.round(p.piHigh);
  const aicc = p.aicc.toFixed(1);

  const wrap = document.createElement('div');
  wrap.appendChild(line(`Predicted ${p.year}: ${yhat}`, { strong: true }));
  wrap.appendChild(line(`95% PI: [${lo}, ${hi}]`));
  wrap.appendChild(line(`Model: ${p.model} (AICc ${aicc})`));
  wrap.appendChild(line(`Based on ${p.nYears} historical year${p.nYears === 1 ? '' : 's'}`));
  wrap.appendChild(line(`YTD: ${ytd}`));
  wrap.appendChild(line(`Confidence: ${p.confidence}`));
  return wrap;
}

export function renderTooltipContent(p, ytd) {
  // String form retained for tests and debugging — always equivalent to buildTooltipNode().outerHTML.
  const yhat = Math.round(p.yhat);
  const lo   = Math.round(p.piLow);
  const hi   = Math.round(p.piHigh);
  const aicc = p.aicc.toFixed(1);
  return [
    `Predicted ${p.year}: ${yhat}`,
    `95% PI: [${lo}, ${hi}]`,
    `Model: ${p.model} (AICc ${aicc})`,
    `Based on ${p.nYears} historical year${p.nYears === 1 ? '' : 's'}`,
    `YTD: ${ytd}`,
    `Confidence: ${p.confidence}`
  ].join('\n');
}

export function createTooltipElement(p, ytd) {
  const el = document.createElement('div');
  el.setAttribute('data-gsp', 'tooltip');
  el.style.cssText = [
    'position: absolute',
    'z-index: 99999',
    'background: rgba(40,40,40,0.95)',
    'color: #fff',
    'padding: 8px 10px',
    'border-radius: 4px',
    'font: 12px/1.4 system-ui, sans-serif',
    'pointer-events: none',
    'white-space: nowrap'
  ].join(';');
  el.appendChild(buildTooltipNode(p, ytd));
  return el;
}
