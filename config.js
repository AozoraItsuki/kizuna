export const config = {
    media: {
        github: "https://github.com/aozoraitsuki"
    },

    platforms: {
        telegram: {
            token: "Your Token",

            owners: [
                {
                    id: 7088128349,
                    name: "Hoshi",
                    isDeveloper: true
                }
            ]
        },

        discord: {
            token: "Your Token",

            owners: [
                {
                    id: "857573701611159573",
                    name: "Hoshi",
                    isDeveloper: true
                }
            ]
        },

        whatsapp: {
            name: "Yui",
            number: "628**********",
            pairingCode: "HKRHOSHI",
            usePairing: true,
            owners: [
                {
                    id: "628*********@s.whatsapp.net",
                    name: "Hoshi",
                    isDeveloper: true
                }
            ]
        }
    },
    logs: {
        websocket: {
            enable: false,
            port: 3001,
            apiKey: "SECRET_TOKEN"
        }
    },
    prefix: /^[!/.\#]/
};
