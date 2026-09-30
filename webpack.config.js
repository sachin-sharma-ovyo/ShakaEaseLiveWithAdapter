const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

// Bundles the web app only. packages/shared-sdk is type-checked by `tsc`, not emitted here.
module.exports = {
  entry: './src/index.ts',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
    environment: {
      arrowFunction: true,
      const: true,
      destructuring: true,
      forOf: true,
      optionalChaining: false,
      templateLiteral: true,
      bigIntLiteral: false,
      dynamicImport: false,
      module: false,
    },
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        // Dependencies are published with newer syntax. Downlevel them to ES2015.
        test: /\.js$/,
        loader: 'babel-loader',
        options: {
          presets: [
            [
              '@babel/preset-env',
              {
                targets: { chrome: '51', firefox: '54', safari: '10' },
                modules: false,
                bugfixes: true,
              },
            ],
          ],
        },
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './index.html',
    }),
  ],
  devServer: {
    port: 8080,
    hot: true,
  },
};
