//Custom Shader Code

export function modifyShader(material, angle, signsLength) {
    material.onBeforeCompile = (shader) => {        
        // console.log(shader.vertexShader);
        // console.log(shader.colorShader);
        // console.log(material);

        shader.uniforms.angle = { value : angle};
        shader.uniforms.signsLength = {value: signsLength};
        shader.vertexShader = `
            attribute float Angle_0;
            attribute float Angle_30;
            attribute float Angle_60;
            attribute float Angle_90;
            attribute float Angle_120;
            attribute float Angle_150;
            attribute float Angle_180;
            attribute float Angle_210;
            attribute float Angle_240;
            attribute float Angle_270;
            attribute float Angle_300;
            attribute float Angle_330;

            
            uniform float angle;
            uniform int signsLength;
            varying float vVisible;
        ` + shader.vertexShader;

        shader.vertexShader = shader.vertexShader.replace(
            `#include <begin_vertex>`,
            `#include <begin_vertex>

            float values[100];
            values[0] =  Angle_0;
            values[1] =  Angle_30;
            values[2] =  Angle_60;
            values[3] =  Angle_90;
            values[4] =  Angle_120;
            values[5] =  Angle_150;
            values[6] =  Angle_180;
            values[7] =  Angle_210;
            values[8] =  Angle_240;
            values[9] =  Angle_270;
            values[10] = Angle_300;
            values[11] = Angle_330;
            
            int signsIndex = 0;
            for(int i = 0; i < signsLength; i++)
            {
                if(angle >= float(30 * i) && angle < float(30 * (i + 1)))
                {
                    signsIndex = i;
                }
            }

            float normalizedAngle = 0.0;
            normalizedAngle = angle - float(30 * signsIndex);
            normalizedAngle = normalizedAngle / float(30);
            
            int val = 0;
            int next = 0;
           
            if(signsIndex == 11)
                next = 0;
            else
                next = signsIndex + 1;
                    
            if(abs(values[signsIndex] - values[next]) < 0.00001)
                val = int(round(values[signsIndex]));
            else
            {
                if(normalizedAngle > 0.5)
                {
                    val = int(round(values[next]));
                }
                else
                {
                    val = int(round(values[signsIndex]));
                }   
            }
            
            if(val == 0)
                vVisible = 0.0;
            else
                vVisible = 1.0; 
            `
        );

        shader.fragmentShader = `
            varying float vVisible;
        ` + shader.fragmentShader;

        shader.fragmentShader = shader.fragmentShader.replace(
            `#include <clipping_planes_fragment>`,
            `
            if(abs(vVisible - 0.0) < 0.00001)
                discard;     
            #include <clipping_planes_fragment>
            `
        );
        material.userData.shader = shader;
    };
}

export function discardWithNormals(material)
{
    
    material.onBeforeCompile = (shader) => {
        // console.log(shader.vertexShader);
        // console.log(shader.fragmentShader);
        // Adding varying for visibility
        shader.vertexShader = `
            varying float vVisible;
            ` + shader.vertexShader;
        // Replace the point size computation with visibility calculation
        shader.vertexShader = shader.vertexShader.replace(
            `gl_PointSize = size;`,
            `
            vec3 vNormal = normalMatrix * normal; // Assume each point's normal is its position
            vVisible = dot( -normalize(mvPosition.xyz), normalize(vNormal) );
            gl_PointSize = size;
            `
        );
        // vVisible = step( 0., dot( -normalize(mvPosition.xyz), normalize(vNormal) ) );
        // if (floor(vVisible + 0.1) == 0.0) {

        // Fragment shader modification to discard hidden points
        shader.fragmentShader = `
            varying float vVisible;
            ` + shader.fragmentShader;

        shader.fragmentShader = shader.fragmentShader.replace(
            `#include <clipping_planes_fragment>`,
            `
            if (vVisible <= -0.3) discard;
            #include <clipping_planes_fragment>
            `

        // 	`vec4 diffuseColor = vec4( diffuse, opacity );`,
        // 	`
        // 	vec4 diffuseColor;
        //  if ( floor(vVisible + 0.1) == 0.0 ) discard;
        // 	if (vVisible <= 0.0) {
        // 		diffuseColor = vec4(0.0, 0.0, 0.0, opacity); // When not visible set as black
        // 	} else {
        // 		diffuseColor = vec4(0.0, 1.0, 0.0, opacity); // When visible set as red
        // 	}
        // `

        );
    };
}

export function discardAddDepth(material, nearPlane, farPlane)
{
    material.onBeforeCompile = (shader) => {

        shader.uniforms.nearPlane = { value : nearPlane};
        shader.uniforms.farPlane = { value : farPlane};

        const varyingDeclarations = `
            varying float vVisible;
            varying float depth;
            uniform float nearPlane;
            uniform float farPlane;
        `;
        
        shader.vertexShader = varyingDeclarations + shader.vertexShader;
        shader.fragmentShader = varyingDeclarations + shader.fragmentShader;

        shader.vertexShader = shader.vertexShader.replace(
            '#include <project_vertex>',
            `
            #include <project_vertex>

            vec3 vNormal = normalMatrix * normal;
            vVisible = dot( -normalize(mvPosition.xyz), normalize(vNormal) );

            depth = -mvPosition.z;
            `
        );

        shader.fragmentShader = shader.fragmentShader.replace(
            `#include <clipping_planes_fragment>`,
            `
            #include <clipping_planes_fragment>
            
            // Discard pixel if it's "facing away" from the camera.
            if (vVisible <= 0.0) discard; 
            `
        );

        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <color_fragment>',
            `
            #include <color_fragment>
            
            float normalizedDepth = (depth - nearPlane) / (farPlane - nearPlane);
            
            // This gives you the inverse, mapping [-near, -far] to [0, 1].
            // This is usually what people want (near = 0, far = 1).
            // normalizedDepth = (depth + nearPlane) / (nearPlane - farPlane);

            diffuseColor.a = normalizedDepth; 
            `
        );
    };
}

export function addDepth(material, nearPlane, farPlane)
{
    material.onBeforeCompile = (shader) => {

        shader.uniforms.nearPlane = { value : nearPlane};
        shader.uniforms.farPlane = { value : farPlane};

        const varyingDeclarations = `
            varying float depth;
            uniform float nearPlane;
            uniform float farPlane;
        `;
        
        shader.vertexShader = varyingDeclarations + shader.vertexShader;
        shader.fragmentShader = varyingDeclarations + shader.fragmentShader;

        shader.vertexShader = shader.vertexShader.replace(
            '#include <project_vertex>',
            `
            #include <project_vertex>

            depth = -mvPosition.z;
            `
        );
        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <color_fragment>',
            `
            #include <color_fragment>
            
            float normalizedDepth = (depth - nearPlane) / (farPlane - nearPlane);

            diffuseColor.a = normalizedDepth; 
            `
        );
    };
}