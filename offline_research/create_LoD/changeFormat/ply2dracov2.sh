#!/bin/bash

# --- Configuration ---
# IMPORTANT: Set the full, absolute path to your draco_encoder executable.
DRACO_ENCODER_PATH="../../draco/build/draco_encoder"

# --- Script Logic ---

# Check if source and destination directories were provided.
if [ "$#" -ne 2 ]; then
    echo "Usage: $0 <source_directory> <destination_directory>"
    exit 1
fi

INPUT_DIR="$1"
OUTPUT_DIR="$2" 

# Verify that the draco_encoder executable exists.
if [ ! -x "$DRACO_ENCODER_PATH" ]; then
    echo "Error: draco_encoder not found or not executable at '$DRACO_ENCODER_PATH'"
    echo "Please update the DRACO_ENCODER_PATH variable in the script."
    exit 1
fi

# --- MODIFICATION: Create the top-level output directory ---
# This ensures the destination exists before we start adding files.
mkdir -p "$OUTPUT_DIR"

echo "Starting Draco encoding..."
echo "Source:      $INPUT_DIR"
echo "Destination: $OUTPUT_DIR"
echo "----------------------------------------"

# --- MODIFICATION: Initialize a counter for sequential naming ---
counter=0

# Find all .ply files, sort them to ensure consistent order, and process them.
find "$INPUT_DIR" -type f -name "*.ply" -print0 | sort -z | while IFS= read -r -d '' ply_file; do

    # --- MODIFICATION: Generate the new sequential filename ---
    # 'printf "%04d"' pads the counter with leading zeros (e.g., 0 -> 0000, 1 -> 0001, 10 -> 0010).
    output_filename=$(printf "frame%04d.drc" $counter)
    drc_file="$OUTPUT_DIR/$output_filename"

    # The original logic for creating subdirectories is no longer needed
    # as all files are placed in the root of the output directory.

    echo "Input:  $ply_file"
    echo "Output: $drc_file"

    # Execute the draco_encoder with the new output path.
    "$DRACO_ENCODER_PATH" -point_cloud -i "$ply_file" -o "$drc_file" --preserve_order

    # --- MODIFICATION: Increment the counter for the next file ---
    ((counter++))

    echo "----------------------------------------"
done

echo "Batch encoding complete. Total files processed: $counter"
