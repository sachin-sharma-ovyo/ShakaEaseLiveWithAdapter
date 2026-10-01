const fs = require('fs');
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

// Copies each brands/*.json next to the bundle so a client can edit a tenant file
// after the SDK is built, then open the player with ?brand=<file name>.
function copyBrandConfigs(compiler) {
  const { webpack } = compiler;
  compiler.hooks.thisCompilation.tap('CopyBrandConfigs', (compilation) => {
    compilation.hooks.processAssets.tap(
      {
        name: 'CopyBrandConfigs',
        stage: webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
      },
      () => {
        const brandsDir = path.resolve(__dirname, '../brands');
        for (const file of fs.readdirSync(brandsDir)) {
          if (!file.endsWith('.json')) {
            continue;
          }
          const source = fs.readFileSync(path.join(brandsDir, file));
          compilation.emitAsset(`brands/${file}`, new webpack.sources.RawSource(source));
        }
      },
    );
  });
}

// Bundles the web app only. ../shared is type-checked by `tsc`, not emitted here.
module.exports = {
  entry: './src/index.ts',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
  },
  resolve: {
    extensions: ['.ts', '.js', '.css'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './index.html',
    }),
    { apply: copyBrandConfigs },
  ],
  devServer: {
    port: 8080,
    hot: true,
  },
};
