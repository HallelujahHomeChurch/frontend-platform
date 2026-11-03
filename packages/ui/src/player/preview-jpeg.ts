// The current private sprite format is exactly six 160×90 JPEG tiles.
export function validatePreviewJpeg(data:Uint8Array) {
  if(data[0]!==0xff||data[1]!==0xd8)throw new Error('Invalid preview JPEG');
  let offset=2;
  while(offset+4<=data.length){
    if(data[offset++]!==0xff)throw new Error('Invalid preview marker');
    while(data[offset]===0xff)offset++;
    const marker=data[offset++];
    const length=(data[offset]<<8)|data[offset+1];
    if(length<2||offset+length>data.length)throw new Error('Truncated preview header');
    if(marker===0xc0||marker===0xc1||marker===0xc2){
      if(length<8)throw new Error('Invalid preview frame');
      const height=(data[offset+3]<<8)|data[offset+4];
      const width=(data[offset+5]<<8)|data[offset+6];
      if(width!==960||height!==90)throw new Error('Unsupported preview dimensions');
      return;
    }
    if(marker===0xda||marker===0xd9)break;
    offset+=length;
  }
  throw new Error('Missing preview frame');
}
