module.exports = {
    "env": {
        "browser": false,
        "es6": true
    },
    "extends": "standard",
    "globals": {
        "Atomics": "readonly",
        "SharedArrayBuffer": "readonly"
    },
    "parserOptions": {
        "ecmaVersion": 2018,
        "sourceType": "module"
    },
    "rules": {
        "indent": ["error", 4],
        "linebreak-style": ["error", "unix"],
        "quotes": ["error", "double"],
        "semi": ["error", "always"],
        "camelcase": "off",
        // "no-unused-vars": "off",
        "eqeqeq": "off",
        "comma-dangle": [ "error", "never" ],
        "comma-style": [ "error", "last" ],
        "comma-spacing": "off",
        "space-before-function-paren": [ "error", "never" ],
        "space-in-parens": [ "error", "always" ],
        "keyword-spacing": [ "error", {
            "overrides": {
                "if": { "before": false, "after": false }
                , "else": { "before": true, "after": true }
                , "for": { "before": false, "after": false }
                , "while": { "before": false, "after": false }
            }
        } ],
        "space-before-blocks": ["error", "always"],
        "object-curly-spacing": ["error", "always"],
        "no-cond-assign": ["error", "always"],
        "no-console": "off",
        "new-cap": "off",
        "no-tabs": "off",
        "no-mixed-spaces-and-tabs": "off",
        "no-prototype-builtins": "off",
        "quote-props": "off"
    }
};
