#!/bin/bash

# A script to process all .ply files in a directory, extracting a number
# from each filename to create a corresponding zero-padded output folder.

# --- Configuration ---
# Path to your pre-compiled C++ executable.
EXECUTABLE="./build/exe"

# --- Usage Function ---
usage() {
    echo "Usage: $0 <input_directory> <output_directory>"
    exit 1
}

# --- Argument Validation ---
if [ "$#" -ne 2 ]; then
    usage
fi

INPUT_DIR="$1"
OUTPUT_DIR="$2"

# Check if the executable exists and is executable.
if [ ! -x "$EXECUTABLE" ]; then
    echo "Error: Executable '$EXECUTABLE' not found or not executable."
    exit 1
fi

# Check if input and output directories exist.
if [ ! -d "$INPUT_DIR" ]; then
    echo "Error: Input directory '$INPUT_DIR' not found."
    usage
fi

if [ ! -d "$OUTPUT_DIR" ]; then
    echo "Error: Output directory '$OUTPUT_DIR' not found."
    usage
fi

# --- File Processing ---
echo "--- Starting file processing ---"

# Initialize a variable to store the number from the first file.
start_frame_number=-1

find "$INPUT_DIR" -maxdepth 1 -type f -name "*.ply" -print0 | sort -z | while IFS= read -r -d $'\0' input_file; do
    
    # 1. Extract just the filename from the full path (e.g., "frame0.ply").
    filename=$(basename -- "$input_file") 

    # for orignal filename case
    # 2. Extract the LAST number from the filename using a new regex.
    # This looks for an underscore, followed by digits, right before ".ply".
    if [[ $filename =~ _([0-9]+)\.ply$ ]]; then
        extracted_number="${BASH_REMATCH[1]}"
        extracted_number=$((10#$extracted_number))
        
        # 3. If this is the first file, set its number as the starting offset.
        if (( $start_frame_number == -1 )); then
            start_frame_number=$extracted_number
        fi
        
        # Example: If extracted is 1051 and start is 1051, index becomes 0.
        #          If extracted is 1052 and start is 1051, index becomes 1.
        frame_index=$((extracted_number - start_frame_number))
    
        # Example: If frame_number is 0, frame_folder becomes "frame0000".
        printf -v frame_folder "frame%04d" "$frame_index"
        
        # 4. Construct the full path for the output directory.
        output_path="${OUTPUT_DIR}${frame_folder}/"
        
        # 5. Create the output directory. The '-p' flag prevents errors if it already exists.
        mkdir -p "$output_path"
        
        echo "Processing: '$input_file' -> '$output_path'"
        
        # 6. Execute your C++ program.
        "$EXECUTABLE" "$input_file" "$output_path"
    else
        echo "Warning: Could not extract frame number from '$filename'. Skipping."
    fi
done

echo "--- Processing complete ---"
exit 0