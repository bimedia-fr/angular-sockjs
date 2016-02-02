/*jslint browser: true, nomen: true, plusplus: true, vars: true, eqeq: true*/
/*global define, require, angular */

define([
    'angular',
    'sockjs-client'
], function (angular, SockJS) {

    "use strict";

    angular.module('angular-sockjs', [])
    .provider("$socket", function () {

        var options = {
            address: null,
            broadcastPrefix: "$socket.",
            reconnectInterval: 3000,
            parser: null,
            formatter: null
        };

        function parser(msg) {
            return angular.fromJson(msg);
        }

        function formatter(event, data) {
            return angular.toJson([event, data]);
        }

        function socketFactory($rootScope, $interval, $log) {
            var self = this;

            self.socket = null;
            self.multiplexer = null;
            self.channels = [];
            self.queue = [];

            self.interval = null;

            /**
             * Attaches listener on $rootScope or to the provided scope
             * @param event
             * @param listener
             * @param scope
             * @returns {*|(function())}
             */
            function on(event, listener, scope) {
                return (scope || $rootScope).$on(options.broadcastPrefix + event, listener);
            }

            /**
             * Sends the message if connected or queues it for later
             * @param channel
             * @param event
             * @param data
             * @returns {boolean}
             */
            function send(channel, event, data) {
                var c = self.getChannel(channel);
                var message = (options.formatter || formatter)(event, data);

                self.queue[c.name].push(message);
                return self.sendChannelQueues(c);
            }

            /**
             * Init new socket
             * @param url
             * @returns {*}
             */
            function initSocket(url) {
                self.socket = null;

                if (url) {
                    options.address = url;
                }

                if (!SockJS) {
                    return $log.error(new Error("Must include SockJS for angular-sockjs to work"));
                }
                if (!options.address) {
                    return $log.error(new Error("Must configure the address"));
                }

                self.socket = new SockJS(options.address);
                $log.info('Connecting to ' + options.address);

                self.interval = $interval(function() {
                    self.checkSocket(url);
                }, options.reconnectInterval);
            }

            /**
             * Init new channel
             * @param channel
             * @returns {*}
             */
            function initChannel(channel) {

                if (!self.socket) {
                    return $log.error(new Error("Socket must be started before channel, see start() method"));
                }

                if (!channel) {
                    return $log.error(new Error("Channel must be defined"));
                }

                if (!WebSocketMultiplex) {
                    return $log.error(new Error("Must include WebSocketMultiplex for channels to work"));
                }

                if (!self.multiplexer) {
                    self.multiplexer = new WebSocketMultiplex(self.socket);
                }

                $log.info('Initializing "' + channel.name + '" channel');

                var c = self.multiplexer.channel(channel.name);
                c.connected = false;

                if (!self.queue[c.name]) {
                    self.queue[c.name] = [];
                }

                c.onopen = function() {
                    $rootScope.$broadcast(options.broadcastPrefix + c.name + ".open");
                    c.connected = true;
                };

                c.onmessage = function(msg) {
                    msg = (options.parser || parser)(msg.data);
                    if (!Array.isArray(msg) || msg.length !== 2) {
                        return $log.error(new Error("Invalid message " + msg.toString()));
                    }
                    if (!msg[1].success) {
                        $rootScope.$broadcast(options.broadcastPrefix + c.name + ".error", msg);
                    }
                    $rootScope.$broadcast(options.broadcastPrefix + c.name + "." + msg[0], msg[1]);
                };

                c.onclose = function() {
                    $rootScope.$broadcast(options.broadcastPrefix + c.name + ".close");
                    self.socket = null;
                    c.connected = false;
                };

                self.channels.push(c);
            }

            /**
             * Checks if socket opened
             * @param url
             */
            self.checkSocket = function (url) {
                if (!self.socket || self.socket.readyState === 3) {
                    self.socket = null;
                    $interval.cancel(self.interval);
                    self.channels.forEach(function(channel) {
                        $rootScope.$broadcast(options.broadcastPrefix + channel.name + ".close");
                    });
                    initSocket(url);
                }
            };

            /**
             * Return channel by name
             * @param name
             * @returns {*}
             */
            self.getChannel = function (name) {
                if (!self.socket || !self.channels) {
                    return $log.error(new Error("No channel found !"));
                }

                var c = null;
                self.channels.some(function(channel) {
                    if (channel.name === name) {
                        c = channel;
                        return true;
                    }
                    return false;
                });
                return c || self.channels[0];
            };

            self.sendChannelQueues = function (channel) {
                if (channel && channel.connected && self.queue[channel.name].length) {
                    self.queue[channel.name].forEach(function(msg) {
                        delete self.queue[channel.name][msg];
                        channel.send(msg);
                    });
                    self.queue[channel.name].splice(0);
                    return true;
                }
                return false;
            };

            return {
                start: initSocket,
                initChannel: initChannel,
                send: send,
                on: on,
                socket: function() {
                    return socket;
                }
            };
        }


        this.$get = socketFactory;

        this.configure = function(opt) {
            angular.extend(options, opt);
        };

    });
});
