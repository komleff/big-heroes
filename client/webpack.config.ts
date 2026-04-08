import path from 'path';
import { fileURLToPath } from 'url';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import { Configuration } from 'webpack';
import type { Configuration as DevServerConfiguration } from 'webpack-dev-server';

type WebpackConfig = Configuration & { devServer?: DevServerConfiguration };

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const config: WebpackConfig = {
    entry: './src/main.ts',
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
            {
                test: /\.(png|jpe?g|gif|svg)$/i,
                type: 'asset/resource',
            },
        ],
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
        alias: {
            '@config': path.resolve(__dirname, '../config'),
        },
    },
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'dist'),
        clean: true,
        // /big-heroes/ — путь проекта на GitHub Pages (komleff.github.io/big-heroes/)
        publicPath: process.env.NODE_ENV === 'production' ? '/big-heroes/' : '/',
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: './index.html',
        }),
    ],
    devServer: {
        port: 5173,
        host: '0.0.0.0',
        open: true,
        allowedHosts: 'all',
    },
};

export default config;
