import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Engine } from "@babylonjs/core/Engines/engine";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Scene } from "@babylonjs/core/scene";
import { AsyncDataConnection, AsyncMediaConnection, AsyncPeer } from "./asyncPeer";
import { LocalAttendee } from "./localAttendee";
import { RemoteAttendee } from "./remoteAttendee";
import { Tools } from "@babylonjs/core/Misc/tools";
import { WebXRInputSource } from "@babylonjs/core/XR/webXRInputSource";
import { WebXRFeatureName } from "@babylonjs/core/XR/webXRFeaturesManager";
import { CubeTexture } from "@babylonjs/core/Materials/Textures/cubeTexture";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";

//import "@babylonjs/inspector";

export interface IMeetingSpaceSceneParams {
    engine: Engine;
    assetsHostUrl: string;
    registryUrl: string;
}

export class MeetingSpaceScene extends Scene {
    private _assetsHostUrl: string;
    private _registryUrl: string;
    private _peer?: AsyncPeer;
    private _localAttendee: LocalAttendee;
    private _remoteAttendees: Map<string, RemoteAttendee>;

    private constructor(params: IMeetingSpaceSceneParams, localAttendee: LocalAttendee) {
        super(params.engine);

        this._assetsHostUrl = params.assetsHostUrl;
        this._registryUrl = params.registryUrl;
        this._localAttendee = localAttendee;
        this._remoteAttendees = new Map<string, RemoteAttendee>();
    }

    public dispose() {
        this.leaveSpace();
        this._localAttendee.dispose();
        super.dispose();
    }

    private async _initializeVisualsAsync(): Promise<void> {
        this.createDefaultLight();
        await SceneLoader.ImportMeshAsync("", this._assetsHostUrl, "manifold_room.glb");

        const centerEnvironmentTexture = CubeTexture.CreateFromPrefilteredData(`${this._assetsHostUrl}/bake_environment_center.env`, this);
        this.environmentTexture = centerEnvironmentTexture;
        
        const counterEnvironmentTexture = CubeTexture.CreateFromPrefilteredData(`${this._assetsHostUrl}/bake_environment_counter.env`, this);
        (this.getMeshByName("counter_top")!.material as PBRMaterial).reflectionTexture = counterEnvironmentTexture;

        const tvEnvironmentTexture = CubeTexture.CreateFromPrefilteredData(`${this._assetsHostUrl}/bake_environment_tv.env`, this);
        (this.getMeshByName("tv")!.material as PBRMaterial).reflectionTexture = tvEnvironmentTexture;

        const whiteboardEnvironmentTexture = CubeTexture.CreateFromPrefilteredData(`${this._assetsHostUrl}/bake_environment_whiteboard.env`, this);
        (this.getMeshByName("whiteboard")!.material as PBRMaterial).reflectionTexture = whiteboardEnvironmentTexture;

        const windowEnvironmentTexture = CubeTexture.CreateFromPrefilteredData(`${this._assetsHostUrl}/bake_environment_window.env`, this);
        (this.getMeshByName("window_glass")!.material as PBRMaterial).reflectionTexture = windowEnvironmentTexture;

        const camera = new FreeCamera("camera", new Vector3(0, 1.6, 0), this, true);
        camera.rotationQuaternion = Quaternion.Identity();
        camera.attachControl();
        camera.speed = 0.04;
        camera.minZ = 0.01;
        camera.maxZ = 100;
        
        const xr = await this.createDefaultXRExperienceAsync({
            floorMeshes: [this.getMeshByName("floor")!]
        });
        xr.baseExperience.camera.rotationQuaternion = Quaternion.Identity();

        xr.baseExperience.featuresManager.enableFeature(WebXRFeatureName.HAND_TRACKING, "latest", {
            xrInput: xr.input
        });

        let leftController: WebXRInputSource | undefined;
        let rightController: WebXRInputSource | undefined;
        xr.input.onControllerAddedObservable.add((controller) => {
            controller.onMotionControllerInitObservable.add((motionController) => {
                if (motionController.handedness === "left") {
                    leftController = controller;
                } else if (motionController.handedness === "right") {
                    rightController = controller;
                }
                controller.grip!.rotationQuaternion = Quaternion.Identity();
            });
        });

        // TODO: This should probably be moved to the local attendee.
        const scene = this;
        scene.onBeforeRenderObservable.runCoroutineAsync(function* () {
            let message: any;

            while (!scene.isDisposed) {
                if (xr.baseExperience.sessionManager.inXRSession) {
                    message = RemoteAttendee.CreateXrTransformsMessage(
                        xr.baseExperience.camera.position,
                        xr.baseExperience.camera.rotationQuaternion,
                        leftController ? leftController.grip?.position : undefined,
                        leftController ? leftController.grip?.rotationQuaternion! : undefined,
                        rightController ? rightController.grip?.position : undefined,
                        rightController ? rightController.grip?.rotationQuaternion! : undefined,
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

    private _addRemoteAttendee(dataConnection: AsyncDataConnection, mediaConnection: AsyncMediaConnection) {
        const peerId = dataConnection.peerId;
        const attendee = new RemoteAttendee(this, dataConnection, mediaConnection);
        this._remoteAttendees.set(peerId, attendee);

        attendee.OnDisconnectedObservable.addOnce(() => {
            this._remoteAttendees.delete(peerId);
            attendee.dispose();
        });
    }

    private _connectToPeer(peerId: string): void {
        this._peer!.createDataConnectionAsync(peerId).then((dataConnection) => {
            // TODO: Provide anything the remote peer needs to accept the connection.

            const observer = this._peer!.onMediaConnectionObservable.add((mediaConnection) => {
                if (mediaConnection.peerId != peerId) {
                    return;
                }

                this._peer!.onMediaConnectionObservable.remove(observer);

                mediaConnection.answer(this._localAttendee.AudioStream);
                this._addRemoteAttendee(dataConnection, mediaConnection);
            });
        });
    }

    public async joinSpaceAsync(space: string): Promise<void> {
        await this._localAttendee.startAudioStreamAsync();
        this._peer = await AsyncPeer.CreateAsync();

        // Handle connections from attendees who join after we do.
        this._peer.onDataConnectionObservable.add((dataConnection) => {
            // TODO: Decide whether to accept this connection, then either accept or reject it
            // and respond with a media connection accordingly.

            const mediaConnection = this._peer!.createMediaConnection(dataConnection.peerId, this._localAttendee.AudioStream);

            this._addRemoteAttendee(dataConnection, mediaConnection);
        });

        const response = await fetch(`${this._registryUrl}join`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                space: space,
                id: this._peer!.id
            })
        });
        const json = await response.json();
        const peerIds = json.ids as string[];

        peerIds.forEach((id) => {
            this._connectToPeer(id);
        });
    }

    public leaveSpace(): void {
        this._remoteAttendees.forEach((remoteAttendee) => {
            remoteAttendee.dispose();
        });
        this._peer?.dispose();
        this._localAttendee.stopAudioStream();
    }

    public static async CreateAsync(params: IMeetingSpaceSceneParams): Promise<MeetingSpaceScene> {
        const localAttendee = new LocalAttendee();
        const meetingSpace = new MeetingSpaceScene(params, localAttendee);
        await meetingSpace._initializeVisualsAsync();
        //meetingSpace.debugLayer.show();
        return meetingSpace;
    }
}
