const jwt = require('jsonwebtoken');

module.exports = {
    validateToken: (req, res, next) => {
        const authorizationHeader = req.headers.authorization;
        let result;
        if (authorizationHeader) {
            const token = req.headers.authorization.split(' ')[1]; // Bearer <token>
            const options = {
                expiresIn: '2d',
                issuer: 'https://scotch.io'
            };
            try {
                // verify makes sure that the token hasn't expired and has been issued by us
                result = jwt.verify(token, process.env.JWT_SECRET, options);
                // Let's pass back the decoded token to the request object
                req.decoded = result;
                // We call next to pass execution to the subsequent middleware
                next();
            } catch (err) {
                // Throw an error just in case anything goes wrong with verification
                throw new Error(err);
            }
        } else {
            result = {
                error: `Authentication error. Token required.`,
                status: 401
            };
            res.status(401).send(result);
        }
    },

    generateId: (n) => {
        var result           = [];
        var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        var charactersLength = characters.length;
        for (let i = 0; i < n; i++) {
            result.push(characters.charAt(Math.floor(Math.random() * charactersLength)));
        }
        return result.join('');
    }
};