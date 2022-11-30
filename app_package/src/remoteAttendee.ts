import { Sound } from "@babylonjs/core/Audio/sound";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Observable, Observer } from "@babylonjs/core/Misc/observable";
import { Scene } from "@babylonjs/core/scene";
import { Nullable } from "@babylonjs/core/types";
import { AsyncDataConnection, AsyncMediaConnection } from "./asyncPeer";

export class RemoteAttendee {
    private _dataConnection: AsyncDataConnection;
    private _mediaConnection: AsyncMediaConnection;

    private _dataConnectionObserver: Nullable<Observer<void>>;
    private _mediaConnectionObserver: Nullable<Observer<void>>;

    private _headNode: TransformNode;

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

        this._headNode = new TransformNode("remoteAttendee_head", scene);
        this._headNode.position.set(0, 1, 0);

        const sound = new Sound("remoteAttendee", mediaConnection.remoteStream, scene, null, { autoplay: true });
        sound.attachToMesh(this._headNode);

        // TODO: Actually do something with the connections.
        const box = MeshBuilder.CreateBox("box", { size: 1 }, scene);
        box.parent = this._headNode;
    }

    public dispose(): void {
        this._headNode.dispose();

        this._dataConnection.onTerminatedObservable.remove(this._dataConnectionObserver);
        this._mediaConnection.onTerminatedObservable.remove(this._mediaConnectionObserver);

        this._dataConnection.dispose();
        this._mediaConnection.dispose();
    }
}