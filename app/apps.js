// Tiles shown on the home screen.
// `id` is the Samsung app id (used by the TV's local API on 127.0.0.1:8001).
// `module` launches a TizenBrew module instead (e.g. TizenTube).
window.HOME_SHELVES = [
  {
    title: 'Regarder',
    apps: [
      { name: 'Netflix', id: '3201907018807', color: '#e50914', mark: 'N' },
      { name: 'YouTube', sub: 'sans pub', module: 'tizentube', color: '#ff0033', mark: '▶' },
      { name: 'Prime Video', id: '3201910019365', color: '#1a98ff', mark: 'prime' },
      { name: 'Disney+', id: '3201901017640', color: '#113ccf', mark: 'D+' },
      { name: 'Apple TV', id: '3201807016597', color: '#2b2b2f', mark: 'tv' },
      { name: 'Twitch', id: '3202203026841', color: '#9146ff', mark: 'T' },
      { name: 'Rakuten TV', id: '3201511006428', color: '#bf0000', mark: 'R' },
      { name: 'Pluto TV', id: '3201808016802', color: '#2d2f8f', mark: 'P' }
    ]
  },
  {
    title: 'Écouter & plus',
    apps: [
      { name: 'Spotify', id: '3201606009684', color: '#1db954', mark: '♪' },
      { name: 'Apple Music', id: '3201908019041', color: '#fa2d48', mark: '♫' },
      { name: 'YouTube', sub: 'officiel', id: '111299001912', color: '#3a3a3a', mark: '▶' },
      { name: 'Galerie', id: '3201710015037', color: '#c2187b', mark: '✿' },
      { name: 'Internet', id: '3201907018784', color: '#2f6fde', mark: '◎' }
    ]
  }
];
