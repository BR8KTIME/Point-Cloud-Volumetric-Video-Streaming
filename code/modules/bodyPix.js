import '@tensorflow/tfjs-backend-webgl';
import * as bodyPix from '@tensorflow-models/body-pix';

let netmodel;

export async function loadbodyPix()
{
    console.time("Load Model");
    netmodel = await bodyPix.load({
        architecture: 'ResNet50',       
        outputStride: 16,                  
        quantBytes: 2});
    console.timeEnd("Load Model");
}

export async function usebodyPix(image)
{
    console.time("Segmentation");
    const segmentation = await netmodel.segmentPerson(image);
    console.timeEnd("Segmentation");
    return segmentation;
}  
