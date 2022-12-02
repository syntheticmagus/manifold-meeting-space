import { Sound } from "@babylonjs/core/Audio/sound";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Observable, Observer } from "@babylonjs/core/Misc/observable";
import { Scene } from "@babylonjs/core/scene";
import { Nullable } from "@babylonjs/core/types";
import { AsyncDataConnection, AsyncMediaConnection } from "./asyncPeer";

export enum MessageType {
    CameraTransform,
    XrTransforms
}

export class RemoteAttendee {
    private _dataConnection: AsyncDataConnection;
    private _mediaConnection: AsyncMediaConnection;

    private _dataConnectionObserver: Nullable<Observer<void>>;
    private _mediaConnectionObserver: Nullable<Observer<void>>;

    private _audioStreamNode: TransformNode;
    private _cameraNode: TransformNode;
    private _headNode: TransformNode;
    private _leftHandNode: TransformNode;
    private _rightHandNode: TransformNode;

    private _audioStream?: Sound;

    private _onDisconnectedObservable: Observable<void>;
    public get OnDisconnectedObservable(): Observable<void> {
        return this._onDisconnectedObservable;
    }

    public constructor(scene: Scene, dataConnection: AsyncDataConnection, mediaConnection: AsyncMediaConnection, assetsHostUrl: string) {
        this._dataConnection = dataConnection;
        this._mediaConnection = mediaConnection;

        this._onDisconnectedObservable = new Observable<void>();

        this._dataConnectionObserver = this._dataConnection.onTerminatedObservable.add(() => {
            this._onDisconnectedObservable.notifyObservers();
        });
        this._mediaConnectionObserver = this._mediaConnection.onTerminatedObservable.add(() => {
            this._onDisconnectedObservable.notifyObservers();
        });

        this._audioStreamNode = new TransformNode("remoteAttendee_audioStream", scene);
        this._cameraNode = new TransformNode("remoteAttendee_camera", scene);
        this._cameraNode.rotationQuaternion = Quaternion.Identity();
        this._headNode = new TransformNode("remoteAttendee_head", scene);
        this._headNode.rotationQuaternion = Quaternion.Identity();
        this._leftHandNode = new TransformNode("remoteAttendee_leftHand", scene);
        this._leftHandNode.rotationQuaternion = Quaternion.Identity();
        this._rightHandNode = new TransformNode("remoteAttendee_rightHand", scene);
        this._rightHandNode.rotationQuaternion = Quaternion.Identity();

        this._cameraNode.setEnabled(false);
        this._headNode.setEnabled(false);
        this._leftHandNode.setEnabled(false);
        this._rightHandNode.setEnabled(false);

        this._dataConnection.onDataObservable.add((data) => {
            const message = JSON.parse(data);

            let position: any;
            let rotation: any;
            switch (message.type) {
                case MessageType.CameraTransform:
                    position = message.position;
                    rotation = message.rotation;
                    this._audioStreamNode.position.set(position[0], position[1], position[2]);
                    this._cameraNode.position.set(position[0], position[1], position[2]);
                    this._cameraNode.rotationQuaternion!.set(rotation[0], rotation[1], rotation[2], rotation[3]);
                    this._cameraNode.setEnabled(true);
                    
                    this._headNode.setEnabled(false);
                    this._leftHandNode.setEnabled(false);
                    this._rightHandNode.setEnabled(false);
                    break;
                case MessageType.XrTransforms:
                    position = message.headPosition;
                    rotation = message.headRotation;
                    this._audioStreamNode.position.set(position[0], position[1], position[2]);
                    this._headNode.position.set(position[0], position[1], position[2]);
                    this._headNode.rotationQuaternion!.set(rotation[0], rotation[1], rotation[2], rotation[3]);
                    this._headNode.setEnabled(true);
                    
                    if (message.leftHandPosition && message.leftHandRotation) {
                        position = message.leftHandPosition;
                        rotation = message.leftHandRotation;
                        this._leftHandNode.position.set(position[0], position[1], position[2]);
                        this._leftHandNode.rotationQuaternion!.set(rotation[0], rotation[1], rotation[2], rotation[3]);
                        this._leftHandNode.setEnabled(true);
                    } else {
                        this._leftHandNode.setEnabled(false);
                    }
                    
                    if (message.rightHandPosition && message.rightHandRotation) {
                        position = message.rightHandPosition;
                        rotation = message.rightHandRotation;
                        this._rightHandNode.position.set(position[0], position[1], position[2]);
                        this._rightHandNode.rotationQuaternion!.set(rotation[0], rotation[1], rotation[2], rotation[3]);
                        this._rightHandNode.setEnabled(true);
                    } else {
                        this._rightHandNode.setEnabled(false);
                    }
                    
                    this._cameraNode.setEnabled(false);
                    break;
            }
        });

        mediaConnection.onStreamObservable.add(() => {
            this._audioStream?.dispose();
            mediaConnection.workAroundChromeRemoteAudioStreamBug();
            this._audioStream = new Sound("remoteAttendee_audioStream", mediaConnection.remoteStream, scene, null, { autoplay: true });
            this._audioStream.attachToMesh(this._audioStreamNode);
        });

        SceneLoader.ImportMeshAsync("", assetsHostUrl, "hands_and_head.glb", scene).then((result) => {
            const headMesh = result.meshes[0];
            headMesh.setParent(this._headNode);
            headMesh.position.set(0, 0, 0);
            headMesh.rotationQuaternion = Quaternion.FromEulerAngles(0, 0, Math.PI);

            const leftHandMesh = result.meshes[1];
            leftHandMesh.setParent(this._leftHandNode);
            leftHandMesh.position.set(0, 0, 0);
            leftHandMesh.rotationQuaternion = Quaternion.Identity();

            const rightHandMesh = result.meshes[2];
            rightHandMesh.setParent(this._rightHandNode);
            rightHandMesh.position.set(0, 0, 0);
            rightHandMesh.rotationQuaternion = Quaternion.Identity();
            
            // TODO: Replace this with a real camera mesh.
            headMesh.instantiateHierarchy(this._cameraNode, { doNotInstantiate: true });
        });
    }

    public sendMessage(message: any): void {
        this._dataConnection.send(JSON.stringify(message));
    }

    public dispose(): void {
        this._audioStreamNode.dispose();
        this._cameraNode.dispose();
        this._headNode.dispose();
        this._leftHandNode.dispose();
        this._rightHandNode.dispose();

        this._audioStream?.dispose();

        this._dataConnection.onTerminatedObservable.remove(this._dataConnectionObserver);
        this._mediaConnection.onTerminatedObservable.remove(this._mediaConnectionObserver);

        this._dataConnection.dispose();
        this._mediaConnection.dispose();
    }

    public static CreateCameraTransformsMessage(position: Vector3, rotation: Quaternion): any {
        return {
            type: MessageType.CameraTransform,
            position: [position.x, position.y, position.z],
            rotation: [rotation.x, rotation.y, rotation.z, rotation.w]
        };
    }

    public static CreateXrTransformsMessage(
        headPosition: Vector3, 
        headRotation: Quaternion, 
        leftHandPosition?: Vector3, 
        leftHandRotation?: Quaternion, 
        rightHandPosition?: Vector3, 
        rightHandRotation?: Quaternion): any {
        
        const message: any = {
            type: MessageType.XrTransforms,
            headPosition: [headPosition.x, headPosition.y, headPosition.z],
            headRotation: [headRotation.x, headRotation.y, headRotation.z, headRotation.w]
        };
        if (leftHandPosition && leftHandRotation) {
            message.leftHandPosition = [leftHandPosition.x, leftHandPosition.y, leftHandPosition.z];
            message.leftHandRotation = [leftHandRotation.x, leftHandRotation.y, leftHandRotation.z, leftHandRotation.w];
        }
        if (rightHandPosition && rightHandRotation) {
            message.rightHandPosition = [rightHandPosition.x, rightHandPosition.y, rightHandPosition.z];
            message.rightHandRotation = [rightHandRotation.x, rightHandRotation.y, rightHandRotation.z, rightHandRotation.w];
        }
        return message;
    }
}