// Apps shown in the dock, by group.
// `id`   Samsung id or Tizen id of the app (both work with the Tizen API).
// `icon` file name in assets/icons/ (white logo); without it, `mark` is shown as a wordmark.
// `module` launches a TizenBrew module instead (e.g. TizenTube).
window.HOME_SHELVES = [
  {
    title: 'Regarder',
    apps: [
      { name: 'Netflix', id: '3201907018807', icon: 'netflix.svg' },
      { name: 'YouTube', sub: 'Sans pub', module: 'tizentube', icon: 'youtube.svg' },
      { name: 'Prime Video', id: '3201910019365', icon: 'primevideo.svg' },
      { name: 'Disney+', id: '3201901017640', icon: 'disneyplus.svg' },
      { name: 'Canal+', id: 'QmpwflxWdt.CanalPlusLauncher', mark: 'CANAL+' },
      { name: 'Twitch', id: '3202203026841', icon: 'twitch.svg' },
      { name: 'YouTube', sub: 'Officiel', id: '111299001912', icon: 'youtube.svg' }
    ]
  },
  {
    title: 'Écouter',
    apps: [
      { name: 'Spotify', id: '3201606009684', icon: 'spotify.svg' },
      { name: 'Deezer', id: 'cexr1qp97S.Deezer', icon: 'deezer.svg' }
    ]
  }
];
