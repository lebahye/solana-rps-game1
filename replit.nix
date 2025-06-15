
{ pkgs }: {
  deps = [
    pkgs.nodejs-18_x
    pkgs.rustc
    pkgs.cargo
    pkgs.pkg-config
    pkgs.openssl.dev
  ];
}
