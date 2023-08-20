configure_file(
  input: 'resource.gschema.xml',
  output: 'com.github.kinten108101.SteamVPK.gschema.xml',
  copy: true,
  install_dir: datadir / 'glib-2.0' / 'schemas',
)

icondir = 'icons' / 'hicolor' / 'scalable' / 'apps'
configure_file(
  input: 'AddonBox-hicolor.svg',
  output: '@0@.svg'.format(server_id),
  copy: true,
  install_dir: datadir / icondir,
)

desktop_file = configure_file(
  input: 'server.desktop.in',
  output: '@0@.desktop'.format(server_id),
  configuration: { 'SERVER_ID': server_id },
  install: true,
  install_dir: datadir / 'applications',
)
