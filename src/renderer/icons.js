// Little pixel icons for buttons, drawn from text like the sprites are, so the chrome matches
// the characters instead of mixing in system emoji. '#' takes the button's own colour; other
// letters are fixed colours. Any element with data-icon="name" gets its icon put in front.
(function () {
  const COLORS = { r: '#d8462b', g: '#4f9a3d', w: '#ffd2bf' };
  const ICONS = {
    edit: [
      '.......##.',
      '......#..#',
      '.....#..#.',
      '....#..#..',
      '...#..#...',
      '..#..#....',
      '.#..#.....',
      '.###......',
      '.##.......',
      '..........',
    ],
    book: [
      '..#######.',
      '.#.#....#.',
      '.#.#.##.#.',
      '.#.#....#.',
      '.#.#.##.#.',
      '.#.#....#.',
      '.#.######.',
      '.#......#.',
      '..#######.',
    ],
    gear: [
      '....#....',
      '.#.###.#.',
      '..#####..',
      '.##...##.',
      '###...###',
      '.##...##.',
      '..#####..',
      '.#.###.#.',
      '....#....',
    ],
    minus: [
      '........',
      '........',
      '........',
      '.######.',
      '.######.',
      '........',
      '........',
      '........',
    ],
    plus: [
      '........',
      '...##...',
      '...##...',
      '.######.',
      '.######.',
      '...##...',
      '...##...',
      '........',
    ],
    tomato: [
      '...g.g....',
      '....gg....',
      '..rrggrr..',
      '.rrrrrrrr.',
      'rrwrrrrrrr',
      'rwrrrrrrrr',
      'rrrrrrrrrr',
      '.rrrrrrrr.',
      '..rrrrrr..',
    ],
    person: [
      '....##....',
      '...####...',
      '...####...',
      '....##....',
      '..######..',
      '.#.####.#.',
      '.#.####.#.',
      '...#..#...',
      '...#..#...',
      '..##..##..',
    ],
    house: [
      '....##....',
      '...####...',
      '..######..',
      '.########.',
      '##########',
      '.#......#.',
      '.#..##..#.',
      '.#..##..#.',
      '.########.',
    ],
    power: [
      '....##....',
      '.#..##..#.',
      '#...##...#',
      '#...##...#',
      '#........#',
      '#........#',
      '.#......#.',
      '..######..',
    ],
    grip: [
      '#.#',
      '...',
      '#.#',
      '...',
      '#.#',
      '...',
      '#.#',
    ],
    close: [
      '##....##',
      '.##..##.',
      '..####..',
      '...##...',
      '..####..',
      '.##..##.',
      '##....##',
    ],
    photo: [
      '...###....',
      '.########.',
      '#........#',
      '#..####..#',
      '#.##..##.#',
      '#.##..##.#',
      '#..####..#',
      '#........#',
      '.########.',
    ],
    inbox: [
      '....##....',
      '....##....',
      '..######..',
      '...####...',
      '....##....',
      '#........#',
      '#........#',
      '###....###',
      '#..####..#',
      '##########',
    ],
  };

  function svg(name, px = 2) {
    const rows = ICONS[name];
    if (!rows) return '';
    const w = Math.max(...rows.map((r) => r.length));
    const paths = {};
    rows.forEach((row, y) => [...row].forEach((c, x) => {
      if (c !== '.') (paths[c] ||= []).push(`M${x} ${y}h1v1h-1z`);
    }));
    const body = Object.entries(paths)
      .map(([c, d]) => `<path fill="${c === '#' ? 'currentColor' : COLORS[c]}" d="${d.join('')}"/>`).join('');
    return `<svg class="px-icon" width="${w * px}" height="${rows.length * px}" viewBox="0 0 ${w} ${rows.length}" shape-rendering="crispEdges" aria-hidden="true">${body}</svg>`;
  }

  function fill(root = document) {
    for (const el of root.querySelectorAll('[data-icon]')) {
      if (!el.querySelector(':scope > .px-icon')) el.insertAdjacentHTML('afterbegin', svg(el.dataset.icon, Number(el.dataset.px) || 2));
    }
  }

  window.Icons = { svg, fill };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => fill());
  else fill();
})();
