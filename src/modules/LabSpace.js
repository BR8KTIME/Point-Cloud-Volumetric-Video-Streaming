import * as THREE from 'three';


export function deltaE(RGB_vector_1, RGB_vector_2)
{
    let r_1 = RGB_vector_1.getComponent(0);
    let g_1 = RGB_vector_1.getComponent(1);
    let b_1 = RGB_vector_1.getComponent(2);

    let r_2 = RGB_vector_2.getComponent(0);
    let g_2 = RGB_vector_2.getComponent(1);
    let b_2 = RGB_vector_2.getComponent(2);

    r_1 = inverse_gamma(r_1);
    g_1 = inverse_gamma(g_1);
    b_1 = inverse_gamma(b_1);

    r_2 = inverse_gamma(r_2);
    g_2 = inverse_gamma(g_2);
    b_2 = inverse_gamma(b_2);

    let XYZVector_1 = new THREE.Vector3();
    let XYZVector_2 = new THREE.Vector3();
    XYZVector_1 = RGB2XYZ(r_1, g_1, b_1);
    XYZVector_2 = RGB2XYZ(r_2, g_2, b_2);

    let LabVector_1 = new THREE.Vector3();
    let LabVector_2 = new THREE.Vector3();
    LabVector_1 = XYZ2Lab(XYZVector_1);
    LabVector_2 = XYZ2Lab(XYZVector_2);
    
    let color_distance = 0;
    
    let L_1 = 0, L_2 = 0, a_1 = 0, a_2 = 0, b__1 = 0, b__2 = 0;
    L_1 = LabVector_1.getComponent(0);
    L_2 = LabVector_2.getComponent(0);
    a_1 = LabVector_1.getComponent(1);
    a_2 = LabVector_2.getComponent(1);
    b__1 = LabVector_1.getComponent(2);
    b__2 = LabVector_2.getComponent(2);
    
    color_distance = Math.sqrt((L_2 - L_1)**2 + (a_2 - a_1)**2 + (b__2 - b__1)**2);
    
    // console.log(color_distance);
    return color_distance;
}
function RGB2XYZ(r, g, b)
{
    let X = 0, Y = 0, Z = 0;

    X = 0.4124 * r + 0.3576 * g + 0.1805 * b;
    Y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    Z = 0.0193 * r + 0.1192 * g + 0.9505 * b;

    let XYZVector = new THREE.Vector3(X, Y, Z);
    return XYZVector;
}
function XYZ2Lab(XYZVector)
{
    let X = 0, Y = 0, Z = 0;
    
    X = XYZVector.getComponent(0);
    Y = XYZVector.getComponent(1);
    Z = XYZVector.getComponent(2);

    X = X / 95.047;
    Y = Y / 100;
    Z = Z / 108.883;

    X = non_linear_transformation(X);
    Y = non_linear_transformation(Y);
    Z = non_linear_transformation(Z);

    let L = 0, a = 0, b = 0;
    L = (116 * Y) - 16;
    a = 500 * (X - Y);
    b = 200 * (Y - Z);

    let LabVector = new THREE.Vector3(L, a, b);
    return LabVector;
}
function inverse_gamma(component)
{
	component = component / 255;
	if(component > 0.04045)
		component = ((component + 0.055) / 1.055) ** 2.4;
	else
		component = component / 12.92;
	
	component = component * 100;

	return component;
}
function non_linear_transformation(component)
{
	if(component > 0.008856)
		component = component ** (1/3);
	else
		component = (component * 7.787) + (16 / 116);

	return component;
}
