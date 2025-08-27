import jwt from 'jsonwebtoken';
import { config } from './config.js';

export function authRequired(requiredRole = null){
  return (req, res, next) => {
    try{
      const hdr = req.headers['authorization'] || '';
      const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
      if(!token) return res.status(401).json({ error: 'unauthorized' });
      const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev');
      req.user = payload;
      if(requiredRole && payload.role !== requiredRole){
        return res.status(403).json({ error: 'forbidden' });
      }
      next();
    }catch(e){
      return res.status(401).json({ error: 'unauthorized' });
    }
  }
}
