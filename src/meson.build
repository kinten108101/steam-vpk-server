exec_config = configuration_data()
exec_config.set('APP_ID', 'com.github.kinten108101.SteamVPK.Server')
exec_config.set('GJS', gjs_console)
exec_config.set('VERSION', meson.project_version())
exec_config.set('PREFIX', get_option('prefix'))
exec_config.set('DATADIR', get_option('datadir'))
exec_config.set('LIBDIR', get_option('libdir'))
exec_config.set('BUILD_TYPE', get_option('buildtype'))

script = [
  'services/addons.ts',
  'services/dbus-service.ts',
  'services/disk.ts',
  'services/injector.ts',
  'services/settings-writer.ts',
  'services/workshop.ts',
  'steam-vpk-utils/dbus-utils.ts',
  'steam-vpk-utils/portals.ts',
  'steam-vpk-utils/utils.ts',
  'steam-vpk-utils/weakrefmap.ts',
  'add-addon.ts',
  'addon-storage.ts',
  'addons.ts',
  'archiver.ts',
  'const.ts',
  'disk-capacity.ts',
  'downloader.ts',
  'file.ts',
  'id.ts',
  'index-dir.ts',
  'injector.ts',
  'inventory.ts',
  'loadorder-resolver.ts',
  'logger.ts',
  'main.ts',
  'profile.ts',
  'server.ts',
  'settings.ts',
  'simple-inv.ts',
  'steam-api.ts',
]
script_files = files(script)

tsc_out = meson.project_build_root() / 'tsc-out-server'

typescript_server = custom_target(
  'typescript-compile-server',
  input: script_files,
  build_by_default: true,
  build_always_stale: true,
  command: [ yarn, yarn_args, 'run', 'tsc',
    '--outDir', tsc_out,
    '--project', meson.project_source_root() / 'tsconfig.json',
    ],
  depends: [ yarn_deps ],
  output: [ 'tsc-output-server' ],
)

SRC = ''
foreach x : script
  SRC = ''.join([SRC, '<file>'])
  SRC = ''.join([SRC, x.replace('.ts', '.js')])
  SRC = ''.join([SRC, '</file>'])
endforeach

src_manifest = configure_file(
  input:  'resource.src.gresource.xml.in',
  output: 'resource.src.gresource.xml',
  configuration: {
    'SRC': SRC,
  },
)

src_resource = gnome.compile_resources(
  'com.github.kinten108101.SteamVPK.Server.src',
  src_manifest,
  dependencies: typescript_server,
  source_dir: tsc_out, # tsc_out / 'src'
  gresource_bundle: true,
  install: true,
  install_dir: server_pkgdatadir,
)

app_launcher = configure_file(
  input: 'index.js',
  output: 'com.github.kinten108101.SteamVPK.Server.js',
  configuration: exec_config,
)

install_data(
  app_launcher,
  rename: 'com.github.kinten108101.SteamVPK.Server',
  install_dir: get_option('bindir'),
  install_mode: 'rwxrwxrwx',
)
