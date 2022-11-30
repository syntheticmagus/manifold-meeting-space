import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Engine } from "@babylonjs/core/Engines/engine";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Scene } from "@babylonjs/core/scene";
import { AsyncDataConnection, AsyncMediaConnection, AsyncPeer } from "./asyncPeer";
import { LocalAttendee } from "./localAttendee";
import { RemoteAttendee } from "./remoteAttendee";
import { Tools } from "@babylonjs/core/Misc/tools";

// import "@babylonjs/inspector";

export interface IMeetingSpaceSceneParams {
    engine: Engine;
    assetsHostUrl: string;
    registryUrl: string;
    space: string;
}

export class MeetingSpaceScene extends Scene {
    private _assetsHostUrl: string;
    private _registryUrl: string;
    private _space: string;
    private _peer: AsyncPeer;
    private _localAttendee: LocalAttendee;
    private _remoteAttendees: Map<string, RemoteAttendee>;

    private constructor(params: IMeetingSpaceSceneParams, peer: AsyncPeer, localAttendee: LocalAttendee) {
        super(params.engine);

        this._assetsHostUrl = params.assetsHostUrl;
        this._registryUrl = params.registryUrl;
        this._space = params.space;
        this._peer = peer;
        this._localAttendee = localAttendee;
        this._remoteAttendees = new Map<string, RemoteAttendee>();

        // Handle connections from attendees who join after we do.
        peer.onDataConnectionObservable.add((dataConnection) => {
            // TODO: Decide whether to accept this connection, then either accept or reject it
            // and respond with a media connection accordingly.

            const mediaConnection = peer.createMediaConnection(dataConnection.peerId, localAttendee.AudioStream);

            this._addRemoteAttendee(dataConnection, mediaConnection);
        });
    }

    public dispose() {
        this._remoteAttendees.forEach((remoteAttendee) => {
            remoteAttendee.dispose();
        });
        this._localAttendee.dispose();
        this._peer.dispose();

        super.dispose();
    }

    private _addRemoteAttendee(dataConnection: AsyncDataConnection, mediaConnection: AsyncMediaConnection) {
        const peerId = dataConnection.peerId;
        const attendee = new RemoteAttendee(this, dataConnection, mediaConnection);
        this._remoteAttendees.set(peerId, attendee);

        attendee.OnDisconnectedObservable.addOnce(() => {
            this._remoteAttendees.delete(peerId);
            attendee.dispose();
        });
    }

    private async _joinAsync(): Promise<string[]> {
        const response = await fetch(`${this._registryUrl}join`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                space: this._space,
                id: this._peer.id
            })
        });
        const json = await response.json();
        return json.ids as string[];
    }

    private _connectToPeer(peerId: string): void {
        this._peer.createDataConnectionAsync(peerId).then((dataConnection) => {
            // TODO: Provide anything the remote peer needs to accept the connection.

            const observer = this._peer.onMediaConnectionObservable.add((mediaConnection) => {
                if (mediaConnection.peerId != peerId) {
                    return;
                }

                this._peer.onMediaConnectionObservable.remove(observer);

                mediaConnection.answer(this._localAttendee.AudioStream);
                this._addRemoteAttendee(dataConnection, mediaConnection);
            });
        });
    }

    private async _initializeVisualsAsync(): Promise<void> {
        this.createDefaultLight();
        await SceneLoader.ImportMeshAsync("", this._assetsHostUrl, "vr_room.glb");

        const camera = new FreeCamera("camera", new Vector3(0, 1.6, 0), this, true);
        camera.rotationQuaternion = Quaternion.Identity();
        camera.attachControl();
        camera.speed = 0.04;
        camera.minZ = 0.01;
        camera.maxZ = 30;

        const env = this.createDefaultEnvironment({ createGround: false, createSkybox: false });
        const xr = await this.createDefaultXRExperienceAsync({
            floorMeshes: [this.getMeshByName("floor")!]
        });
        xr.baseExperience.camera.rotationQuaternion = Quaternion.Identity();

        // TODO: This should probably be moved to the local attendee.
        const scene = this;
        scene.onBeforeRenderObservable.runCoroutineAsync(function* () {
            let message: any;

            while (!scene.isDisposed) {
                if (xr.baseExperience.sessionManager.inXRSession) {
                    message = RemoteAttendee.CreateXrTransformsMessage(
                        xr.baseExperience.camera.position,
                        xr.baseExperience.camera.rotationQuaternion
                        // TODO: Controllers/hands
                    );
                } else {
                    message = RemoteAttendee.CreateCameraTransformsMessage(camera.position, camera.rotationQuaternion);
                }
                scene._remoteAttendees.forEach((attendee) => {
                    attendee.sendMessage(message);
                });

                yield Tools.DelayAsync(0.1);
            }
        }());
    }

    public static async CreateAsync(params: IMeetingSpaceSceneParams): Promise<MeetingSpaceScene> {
        const peer = await AsyncPeer.CreateAsync();
        const localAttendee = await LocalAttendee.CreateAsync();
        const meetingSpace = new MeetingSpaceScene(params, peer, localAttendee);

        // Handle connections to attendees who joined before us.
        const peerIds = await meetingSpace._joinAsync();
        peerIds.forEach((id) => {
            meetingSpace._connectToPeer(id);
        });

        await meetingSpace._initializeVisualsAsync();

        return meetingSpace;
    }
}
