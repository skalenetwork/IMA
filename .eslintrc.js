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
        "ecmaVersion": 2020,
        "sourceType": "module"
    },
    "rules": {
        "indent": [ "error", 4 ],
        "linebreak-style": [ "error", "unix" ],
        "quotes": [ "error", "double" ],
        "semi": [ "error", "always" ],
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
                "if": { "before": false, "after": false },
                "else": { "before": true, "after": true },
                "for": { "before": false, "after": false },
                "while": { "before": false, "after": false }
            }
        } ],
        "space-before-blocks": [ "error", "always" ],
        "array-bracket-spacing": [ "error", "always" ],
        "object-curly-spacing": [ "error", "always" ],
        "space-unary-ops": "off",
        "spaced-comment": "off",
        "curly": [ "error", "multi-or-nest" ],
        "nonblock-statement-body-position": [ "error", "below" ],
        "one-var": "off",
        "no-unneeded-ternary": "off",
        "no-cond-assign": [ "error", "always" ],
        "no-console": "off",
        "new-cap": "off",
        "no-tabs": "off",
        "no-mixed-spaces-and-tabs": "off",
        "no-prototype-builtins": "off",
        "quote-props": "off",
        "no-undef": "off",
        "no-useless-return": "off",
        "no-new": "off",
        "no-useless-constructor": "off",
        "no-lone-blocks": "off",
        "no-fallthrough": "off",
        "no-useless-catch": "off",
        "padded-blocks": "off",
        "no-use-before-define": "off", // [ "error", { "variables": false,  "functions": false } ],
        "lines-between-class-members": [ "error", "never" ],
        "no-var": "error",
        "no-unused-vars": "error",
        "object-shorthand": 0,
        "multiline-ternary": "off",
        "max-len": [ "error", { "code": 100, "tabWidth": 4 } ],
        "max-lines-per-function": [ "error", { "max": 200, "skipBlankLines": false } ]
    }
};
