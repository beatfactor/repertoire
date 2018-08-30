import nodeResolve from 'rollup-plugin-node-resolve'
import babel from 'rollup-plugin-babel'
import replace from 'rollup-plugin-replace'
import commonjs from 'rollup-plugin-commonjs'
import pkg from './package.json'
import uglify from 'rollup-plugin-uglify'

const env = process.env.NODE_ENV;
const globals = {
  react: 'React',
  redux: 'Redux',
  'react-redux': 'ReactRedux',
  'redux-actions': 'ReduxActions',
  'redux-saga': 'ReduxSaga',
  'redux-saga/effects': 'ReduxSaga.effects'
};

const external = Object.keys(globals);

const config = {
  input: 'src/index.js',
  external,
  output: {
    format: 'umd',
    name: 'repertoire',
    globals
  },
  plugins: [
    nodeResolve(),
    babel({
      exclude: '**/node_modules/**',
      babelrc: false,
      presets: [['env', {modules: false}], 'react'],
      plugins: [
        'transform-class-properties',
        'transform-object-rest-spread',
        'external-helpers',
      ],
    }),
    replace({
      'process.env.NODE_ENV': JSON.stringify(env)
    }),
    commonjs()
  ]
};

if (env === 'production') {
  config.plugins.push(
    uglify({
      compress: {
        pure_getters: true,
        unsafe: true,
        unsafe_comps: true,
        warnings: false
      }
    })
  )
}

export default [
  config,
  {
    input: 'src/index.js',
    output: {
      file: pkg.module,
      format: 'es',
      globals
    },
    external,
    plugins: [babel({
      exclude: '**/node_modules/**',
      babelrc: false,
      presets: [['env', {modules: false}], 'react'],
      plugins: [
        'transform-class-properties',
        'transform-object-rest-spread',
        'external-helpers',
      ]
    })]
  }
]
