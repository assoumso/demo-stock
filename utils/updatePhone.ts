import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export const fixCompanyPhone = async () => {
  try {
    const docRef = doc(db, 'settings', 'app-config');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      // Update if it contains the unwanted numbers
      if (data.companyPhone && (
          data.companyPhone.includes('2723583498') || 
          data.companyPhone.includes('0707575396') || 
          data.companyPhone.includes('0504914867')
        )) {
        await updateDoc(docRef, {
          companyPhone: '07-08-34-13-22' 
        });
        console.log('Company phone updated successfully to 07-08-34-13-22');
      }
    }
  } catch (error) {
    console.error('Error updating company phone:', error);
  }
};
