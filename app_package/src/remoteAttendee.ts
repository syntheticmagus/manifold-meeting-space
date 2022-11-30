import { Sound } from "@babylonjs/core/Audio/sound";
import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Observable, Observer } from "@babylonjs/core/Misc/observable";
import { Scene } from "@babylonjs/core/scene";
import { Nullable } from "@babylonjs/core/types";
import { AsyncDataConnection, AsyncMediaConnection } from "./asyncPeer";

export enum MessageType {
    LocalCameraTransform
}

export class RemoteAttendee {
    private _dataConnection: AsyncDataConnection;
    private _mediaConnection: AsyncMediaConnection;

    private _dataConnectionObserver: Nullable<Observer<void>>;
    private _mediaConnectionObserver: Nullable<Observer<void>>;

    private _cameraNode: TransformNode;

    private _onDisconnectedObservable: Observable<void>;
    public get OnDisconnectedObservable(): Observable<void> {
        return this._onDisconnectedObservable;
    }

    public constructor(scene: Scene, dataConnection: AsyncDataConnection, mediaConnection: AsyncMediaConnection) {
        this._dataConnection = dataConnection;
        this._mediaConnection = mediaConnection;

        this._onDisconnectedObservable = new Observable<void>();

        this._dataConnectionObserver = this._dataConnection.onTerminatedObservable.add(() => {
            this._onDisconnectedObservable.notifyObservers();
        });
        this._mediaConnectionObserver = this._mediaConnection.onTerminatedObservable.add(() => {
            this._onDisconnectedObservable.notifyObservers();
        });

        this._cameraNode = new TransformNode("remoteAttendee_head", scene);
        this._cameraNode.position.set(0, 1, 0);
        this._cameraNode.rotationQuaternion = Quaternion.Identity();

        this._dataConnection.onDataObservable.add((data) => {
            const message = JSON.parse(data);

            switch (message.type) {
                case MessageType.LocalCameraTransform:
                    this._cameraNode.position.set(message.position[0], message.position[1], message.position[2]);
                    this._cameraNode.rotationQuaternion!.set(message.rotation[0], message.rotation[1], message.rotation[2], message.rotation[3]);
                    break;
            }
        });

        let sound: Sound;
        mediaConnection.onStreamObservable.add(() => {
            if (sound) {
                sound.dispose();
            }
            mediaConnection.workAroundChromeRemoteAudioStreamBug();
            sound = new Sound("remoteAttendee", mediaConnection.remoteStream, scene, null, { autoplay: true });
            sound.attachToMesh(this._cameraNode);
        });

        // TODO: Actually do something with the connections.
        const box = MeshBuilder.CreateBox("box", { size: 0.2 }, scene);
        box.parent = this._cameraNode;
    }

    public sendLocalCameraTransform(position: Vector3, rotation: Quaternion): void {
        this._dataConnection.send(JSON.stringify({
            type: MessageType.LocalCameraTransform,
            position: [position.x, position.y, position.z],
            rotation: [rotation.x, rotation.y, rotation.z, rotation.w]
        }));
    }

    public dispose(): void {
        this._cameraNode.dispose();

        this._dataConnection.onTerminatedObservable.remove(this._dataConnectionObserver);
        this._mediaConnection.onTerminatedObservable.remove(this._mediaConnectionObserver);

        this._dataConnection.dispose();
        this._mediaConnection.dispose();
    }
}