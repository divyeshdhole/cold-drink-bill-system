import Owner from '../src/models/Owner.js'

export default async function getOwner() {
  let owner = await Owner.findOne();
  if (!owner) {
    owner = new Owner();
    await owner.save();
  }
  return owner;
}

