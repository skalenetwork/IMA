// SPDX-License-Identifier: AGPL-3.0-only

/**
 * @license
 * SKALE COOL SOCKET
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * @file socketSettings.mjs
 * @copyright SKALE Labs 2019-Present
 */

const settings = {
    rtcSpace: {
        defaultSpaceName: "default space",
        defaultSpaceCategory: "default category"
    },
    net: {
        hostname: "localhost",
        secure: false,
        ports: {
            http: 8080, // 80, 443, 8080
            ws: 17171,
            signaling: 17172
        },
        pipe: {
            maxAccumulatedMessagesCount: 30
        },
        ws: {
            client: {
                reconnectAfterMilliseconds: 100
            }
        },
        rtc: {
            arrKnownIceServers: [
                // see: https://gist.github.com/mondain/b0ec1cf5f60ae726202e
                //      and https://gist.github.com/zziuni/3741933
                // see: https://stackoverflow.com/questions
                //      /20068944/webrtc-stun-stun-l-google-com19302
                // see: https://gist.github.com/yetithefoot/7592580
                // even more to see:
                //      https://gist.github.com/sagivo
                //            /3a4b2f2c7ac6e1b5267c2f1f59ac6c6b
                "stun:stun.1.google.com:19302",
                "stun:stun.2.google.com:19302",
                "stun:stun.3.google.com:19302",
                "stun:stun.4.google.com:19302",
                "stun:stun.5.google.com:19302", // where is the end?
                "stun:stun.l.google.com:19302",
                "stun:stun1.l.google.com:19302",
                "stun:stun2.l.google.com:19302",
                "stun:stun3.l.google.com:19302",
                "stun:stun4.l.google.com:19302",
                "stun:stun5.l.google.com:19302", // where is the end?
                "stun:stun.gmx.net",
                "stun:stun.sipgate.net",
                "stun:stun.sipgate.net:10000",
                "stun:stun.phoneserve.com",
                "stun:stun.counterpath.net",
                "stun:stun.12connect.com:3478",
                "stun:stun.xten.com",
                "stun:stun01.sipphone.com",
                "stun:stun.ekiga.net",
                "stun:stun.fwdnet.net",
                "stun:stun.ideasip.com",
                "stun:stun.iptel.org",
                "stun:stun.schlund.de",
                "stun:stun.voiparound.com",
                "stun:stun.voipbuster.com",
                "stun:stun.voipstunt.com",
                "stun:stun.voxgratia.org"
            ] ,
            peerConfiguration: {
                iceServers: [ {
                    urls: "stun:some.ip.address.here:3478",
                    username: "some.user.name",
                    credential: "some.password"
                } ]
            },
            peerAdditionalOptions: {
                optional: [ { DtlsSrtpKeyAgreement: true } ]
            },
            dataChannel: {
                label: "genericDataChannel",
                opts: { reliable: true, ordered: true }
            },
            maxActiveOfferCount: 10,
            // networkLayer.WebRTCClientPipe only
            isAutoCloseSignalingPipeOnDataChannelOpen: true,
            // 0 - no timeout, 300000 = 5 minutes, 60000 = 1 minute
            timeToPublishMilliseconds: 0,
            // 0 - no timeout, 10000 = 10 seconds to identify by WebRTC
            timeToSignalingNegotiationMilliseconds: 0,
            offerDiscovery: {
                periodMilliseconds: 1000,
                stepCount: 20
            },
            fastPublishMode: {
                serverPeer: true,
                joiner: true
            }
        }
    },
    logging: {
        net: {
            socket: {
                flush: false,
                flushOne: false,
                flushBlock: false,
                flushCount: false,
                flushMethodStats: false,
                accumulate: false,
                send: false,
                receive: false,
                receiveBlock: false,
                receiveCount: false,
                receiveMethodStats: false
            },
            signaling: {
                generic: false,
                connect: true,
                disconnect: true,
                error: true,
                rawMessage: false,
                message: false,
                impersonate: false,
                publishOffer: false,
                objectLifetime: true,
                offer: false,
                answer: false,
                localDescription: false,
                remoteDescription: false,
                candidate: false,
                candidateWalk: false,
                publishTimeout: true,
                signalingNegotiationTimeout: true,
                offerDiscoveryStepFail: true,
                offerRegister: false,
                offerUnregister: false,
                offerSkipPublishedAnswer: false,
                creatorImpersonationComplete: false
            },
            rtc: {
                generic: false,
                error: true,
                closePeer: true,
                closeDataChannel: true,
                iceConnectionStateChange: false,
                iceConnectionStateName: false,
                iceGatheringStateChange: false,
                iceGatheringStateName: false,
                iceIceIdentifyResult: false,
                iceSignalingStateChange: false,
                iceNegotiationNeeded: false
            },
            server: {
                connect: true,
                disconnect: true,
                error: true,
                rawMessage: false,
                message: false,
                impersonate: true,
                weaponShot: false,
                collisionDetection: true
            },
            client: {
                space: { attach: true, detach: true },
                connect: true,
                disconnect: true,
                error: true,
                rawMessage: false,
                message: false,
                impersonate: true
            },
            relay: {
                connect: true,
                disconnect: true,
                error: true,
                rawMessage: false,
                message: false
            }
        }
    }
};

export { settings };
