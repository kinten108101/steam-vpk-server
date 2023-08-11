project(
	'steam-vpk-server',
	version: 'alpha',
	meson_version: '>= 0.63.0',
	license: ['GPL-3.0-or-later'],
)

gnome = import('gnome')
fs = import('fs')

server_id = 'com.github.kinten108101.SteamVPK.Server'
datadir = get_option('datadir')
server_pkgdatadir = datadir / server_id

yarn = find_program('yarn', version: '>=1.22.19', required: true)
gjs = dependency('gjs-1.0', version: '>=1.76.0', required: true)
gjs_console = gjs.get_variable(pkgconfig: 'gjs_console')
gtk4 = dependency('gtk4', version: '>=4.10.3', required: true)
soup3 = dependency('libsoup-3.0', version: '>=3.4.2', required: true)

yarn_args = []
offline_mirror = get_option('offline-mirror')
if offline_mirror != ''
  run_command(
    'yarn',
    'config',
    '--offline',
    'set',
    'yarn-offline-mirror',
    offline_mirror,
    env: { 'HOME': meson.project_build_root() },
    check: true
  )
  yarn_args += [
    '--offline',
    '--prod',
    '--frozen-lockfile',
    '--use-yarnrc', meson.project_build_root() / '.yarnrc'
  ]
endif

yarn_deps = custom_target(
  'yarn-deps',
  command: [ yarn, 'install', yarn_args ],
  output: [ 'yarn-deps-out' ],
)

subdir('src')

gnome.post_install(
  glib_compile_schemas: true,
  gtk_update_icon_cache: true,
  update_desktop_database: true,
)
