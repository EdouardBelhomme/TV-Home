// Tiles shown on the home screen.
// `id` is the app's Samsung id or Tizen id (e.g. 'QmpwflxWdt.CanalPlusLauncher'); either works with the Tizen API.
// `module` launches a TizenBrew module instead (e.g. TizenTube).
window.HOME_SHELVES = [
  {
    title: 'Regarder',
    apps: [
      { name: 'Netflix', id: '3201907018807', color: '#e50914', mark: 'N' },
      { name: 'YouTube', sub: 'sans pub', module: 'tizentube', color: '#ff0033', mark: '▶' },
      { name: 'Prime Video', id: '3201910019365', color: '#1a98ff', mark: 'prime' },
      { name: 'Disney+', id: '3201901017640', color: '#113ccf', mark: 'D+' },
      { name: 'Canal+', id: 'QmpwflxWdt.CanalPlusLauncher', color: '#111111', mark: 'C+' },
      { name: 'Twitch', id: '3202203026841', color: '#9146ff', mark: 'T' }
    ]
  },
  {
    title: 'Écouter & plus',
    apps: [
      { name: 'Spotify', id: '3201606009684', color: '#1db954', mark: '♪' },
      { name: 'YouTube', sub: 'officiel', id: '111299001912', color: '#3a3a3a', mark: '▶' }
    ]
  }
];
