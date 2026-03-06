//Interfaces para el gaze tracking
export interface GazeData{
    sesion_id: bigint;
    timestamp: Date;
    gaze_points: GazePoint[];
}

export interface GazePoint{//Puntos de seguimiento ocular
    x: number;
    y: number;
}