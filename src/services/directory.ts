import GObject from 'gi://GObject';
import Gio from 'gi://Gio';

export class Directory extends GObject.Object {
  static {
    GObject.registerClass({
      Properties: {
        location: GObject.ParamSpec.object(
          'location', '', '',
          GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT,
          Gio.File.$gtype),
      },
    }, this);
  }

  _location!: Gio.File | null;
  get location() {
    if (this._location === null) throw new Error;
    return this._location;
  }
  set location(val: Gio.File) {
    this._location = val;
    this.notify('location');
  }

  constructor(params: {
    location: Gio.File;
  }) {
    super(params);
  }
}
